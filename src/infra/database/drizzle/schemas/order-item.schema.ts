import { integer, pgTable, text, varchar } from 'drizzle-orm/pg-core';

import { orders } from './order.schema';

export const orderItems = pgTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  // Money (VO) é desmembrado em duas colunas — ver money.vo.ts.
  unitPriceCents: integer('unit_price_cents').notNull(),
  unitPriceCurrency: varchar('unit_price_currency', { length: 3 }).notNull().default('BRL'),
});
