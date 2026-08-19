import { describe, expect, it, vi } from 'vitest';
import { Order } from '../domain/order';
import type { OrderRepository, OrderUnitOfWork } from './ports';
import { OrderNotFoundError } from './ports';
import { ConfirmOrder, CreateOrder } from './use-cases';

describe('ordering use cases', () => {
  it('creates and saves an order through the unit-of-work port', async () => {
    const save = vi.fn<OrderUnitOfWork['save']>().mockResolvedValue(undefined);
    const handler = new CreateOrder({ save });

    const result = await handler.execute({
      customerId: 'customer-1',
      currency: 'USD',
      items: [{ sku: 'book', quantity: 1, unitPriceMinor: 2_500 }],
    });

    expect(result.status).toBe('PENDING');
    expect(save).toHaveBeenCalledOnce();
  });

  it('reports a missing order before trying to save', async () => {
    const repository: OrderRepository = { findById: vi.fn().mockResolvedValue(null) };
    const unitOfWork: OrderUnitOfWork = { save: vi.fn() };

    await expect(
      new ConfirmOrder(repository, unitOfWork).execute(crypto.randomUUID()),
    ).rejects.toThrow(OrderNotFoundError);
    expect(unitOfWork.save).not.toHaveBeenCalled();
  });

  it('does not clear events when persistence fails', async () => {
    const order = Order.create({
      customerId: 'customer-1',
      currency: 'USD',
      items: [{ sku: 'book', quantity: 1, unitPriceMinor: 2_500 }],
    });
    const failure = new Error('database unavailable');
    const unitOfWork: OrderUnitOfWork = { save: vi.fn().mockRejectedValue(failure) };

    await expect(unitOfWork.save(order)).rejects.toThrow(failure);
    expect(order.domainEvents).toHaveLength(1);
  });
});
