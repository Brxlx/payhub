import { createZodDto } from 'nestjs-zod';

import { cancelOrderParamsSchema, cancelOrderResponseSchema } from './cancel-order.schema';
import { deleteOrderParamsSchema, deleteOrderResponseSchema } from './delete-order.schema';
import { findManyOrdersQuerySchema, findManyOrdersResponseSchema } from './find-many-orders.schema';
import { findOrderByIdParamsSchema, findOrderByIdResponseSchema } from './find-order-by-id.schema';
import { makeOrderResponseSchema, makeOrderSchema } from './make-order.schema';

export class MakeOrderDTO extends createZodDto(makeOrderSchema) {}
export class MakeOrderResponseDTO extends createZodDto(makeOrderResponseSchema) {}

export class FindOrderByIdParamsDTO extends createZodDto(findOrderByIdParamsSchema) {}
export class FindOrderByIdResponseDTO extends createZodDto(findOrderByIdResponseSchema) {}

export class FindManyOrdersQueryDTO extends createZodDto(findManyOrdersQuerySchema) {}
export class FindManyOrdersResponseDTO extends createZodDto(findManyOrdersResponseSchema) {}

export class CancelOrderParamsDTO extends createZodDto(cancelOrderParamsSchema) {}
export class CancelOrderResponseDTO extends createZodDto(cancelOrderResponseSchema) {}

export class DeleteOrderParamsDTO extends createZodDto(deleteOrderParamsSchema) {}
export class DeleteOrderResponseDTO extends createZodDto(deleteOrderResponseSchema) {}
