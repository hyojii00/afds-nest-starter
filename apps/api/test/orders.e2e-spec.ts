import type { INestApplication } from '@nestjs/common';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrateDatabase, startPostgres } from '../../../tests/support/postgres';
import { configureApplication } from '../src/bootstrap';

describe('orders API', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;

  beforeAll(async () => {
    container = await startPostgres();
    process.env.DATABASE_URL = container.getConnectionUri();
    await migrateDatabase(process.env.DATABASE_URL);

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (container) {
      await container.stop();
    }
  });

  it('creates, reads, and confirms an order', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send({
        customerId: 'customer-1',
        currency: 'USD',
        items: [{ sku: 'BOOK-001', quantity: 2, unitPriceMinor: 2_500 }],
      })
      .expect(201);

    expect(created.body).toMatchObject({ status: 'PENDING', totalAmountMinor: 5_000, version: 1 });
    const id = created.body.id as string;

    await request(app.getHttpServer()).get(`/api/v1/orders/${id}`).expect(200);
    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/orders/${id}/confirm`)
      .expect(200);
    expect(confirmed.body).toMatchObject({ status: 'CONFIRMED', version: 2 });
    await request(app.getHttpServer()).post(`/api/v1/orders/${id}/confirm`).expect(409);
  });

  it('validates input and returns not found for an unknown order', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send({ customerId: '', currency: 'usd', items: [] })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/orders/00000000-0000-4000-8000-000000000000')
      .expect(404);
  });

  it('cancels a pending order and exposes health and OpenAPI endpoints', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send({
        customerId: 'customer-2',
        currency: 'KRW',
        items: [{ sku: 'COFFEE', quantity: 1, unitPriceMinor: 4_500 }],
      })
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/orders/${created.body.id as string}/cancel`)
      .send({ reason: 'Customer request' })
      .expect(200);
    expect(cancelled.body).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: 'Customer request',
    });

    await request(app.getHttpServer()).get('/health/live').expect(200, { status: 'ok' });
    await request(app.getHttpServer()).get('/health/ready').expect(200, { status: 'ok' });
    await request(app.getHttpServer()).get('/docs-json').expect(200);
  });
});
