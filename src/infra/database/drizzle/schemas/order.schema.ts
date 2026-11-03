import { pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const orderStatusEnum = pgEnum('order_status', ['DRAFT', 'PLACED', 'CANCELLED']);

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull(),
  status: orderStatusEnum('status').notNull().default('DRAFT'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  placedAt: timestamp('placed_at', { withTimezone: true }),
  // Soft delete (ver Order.delete()) — null = ativo, preenchido = deletado.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
