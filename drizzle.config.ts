import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './apps/order-activity-consumer/src/schema.ts',
    './packages/ordering/src/infrastructure/persistence/schema.ts',
    './packages/platform/src/outbox/schema.ts',
  ],
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://afds:afds@localhost:5432/afds_nest_starter',
  },
  strict: true,
  verbose: true,
});
