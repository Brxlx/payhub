import z from 'zod';

import { PaginationParamsConsts } from '@/core/consts/pagination.consts';

export const findManyOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  itemsPerPage: z.coerce.number().int().positive().max(PaginationParamsConsts.MAX_ITEMS_PER_PAGE).optional(),
});

export const findManyOrdersResponseSchema = z.object({
  orders: z.array(
    z.object({
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
      deletedAt: z.iso.datetime().nullable(),
    }),
  ),
  total: z.number().int(),
  page: z.number().int(),
  itemsPerPage: z.number().int(),
  hasMore: z.boolean(),
});
