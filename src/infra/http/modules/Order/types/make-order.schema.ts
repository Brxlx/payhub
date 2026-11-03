import z from 'zod';

import { ID } from '@/core/entities/id';

export const makeOrderSchema = z.object({
  customerId: z.string().refine((value: string) => new ID(value).isValid(), { error: 'Invalid ID' }),
  items: z.array(
    z.object({
      id: z.string().refine((value: string) => new ID(value), { error: 'Invalid ID' }),
      quantity: z.number(),
      productId: z.string(),
      unitPriceInCents: z.number().positive(),
    }),
  ),
});

export const makeOrderResponseSchema = z.object({
  id: z.string(),
  productId: z.string(),
  items: z.array(z.object({ id: z.number(), quantity: z.number() })),
  total: z.number(),
  status: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
