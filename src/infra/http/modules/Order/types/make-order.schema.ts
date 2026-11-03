import z from 'zod';

import { ID } from '@/core/entities/id';

export const makeOrderSchema = z.object({
  customerId: z.string().refine((value: string) => new ID(value).isValid(), { error: 'Invalid ID' }),
  items: z
    .array(
      z.object({
        productId: z.string().refine((value: string) => new ID(value).isValid(), { error: 'Invalid ID' }),
        quantity: z.number().int().positive(),
        unitPriceInCents: z.number().int().positive(),
      }),
    )
    .min(1, 'Order must have at least one item'),
});

export const makeOrderResponseSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      productId: z.string(),
      quantity: z.number().int().positive(),
      unitPriceInCents: z.number().int().positive(),
    }),
  ),
  total: z.number().int().positive().min(1).default(1000),
  status: z.enum(['DRAFT', 'PLACED', 'CANCELLED']).default('PLACED'),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().nullable(),
});
