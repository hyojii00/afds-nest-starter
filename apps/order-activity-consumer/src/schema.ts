import { bigint, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const orderActivity = pgTable(
  'order_activity',
  {
    eventId: uuid('event_id').primaryKey(),
    orderId: uuid('order_id').notNull(),
    customerId: varchar('customer_id', { length: 100 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    totalAmountMinor: bigint('total_amount_minor', { mode: 'number' }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('order_activity_order_idx').on(table.orderId, table.occurredAt)],
);
