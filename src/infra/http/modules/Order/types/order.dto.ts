import { createZodDto } from 'nestjs-zod';

import { cancelOrderParamsSchema, cancelOrderResponseSchema } from './cancel-order.schema';
import { makeOrderResponseSchema, makeOrderSchema } from './make-order.schema';

export class MakeOrderDTO extends createZodDto(makeOrderSchema) {}
export class MakeOrderResponseDTO extends createZodDto(makeOrderResponseSchema) {}

export class CancelOrderParamsDTO extends createZodDto(cancelOrderParamsSchema) {}
export class CancelOrderResponseDTO extends createZodDto(cancelOrderResponseSchema) {}
