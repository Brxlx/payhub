import { createZodDto } from 'nestjs-zod';

import { makeOrderResponseSchema, makeOrderSchema } from './make-order.schema';

export class MakeOrderDTO extends createZodDto(makeOrderSchema) {}
export class MakeOrderResponseDTO extends createZodDto(makeOrderResponseSchema) {}
