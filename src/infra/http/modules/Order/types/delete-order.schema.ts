import z from 'zod';

import { ID } from '@/core/entities/id';

export const deleteOrderParamsSchema = z.object({
  id: z.string().refine((value: string) => new ID(value).isValid(), { error: 'Invalid ID' }),
});

export const deleteOrderResponseSchema = z.object({
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
  total: z.number().int(),
  status: z.enum(['DRAFT', 'PLACED', 'CANCELLED']),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().nullable(),
  deletedAt: z.iso.datetime(),
});
