import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';

import { ZodValidationPipe } from '../../pipes/zod-validation.pipe';
import { MakeOrderService } from './make-order.service';
import { makeOrderSchema } from './types/make-order.schema';
import { MakeOrderDTO, MakeOrderResponseDTO } from './types/order.dto';

@Controller('/orders')
export class MakeOrderController {
  constructor(private readonly makeOrderService: MakeOrderService) {}

  @ApiOperation({ summary: 'Make a new order tranfer' })
  @ApiBody({ type: MakeOrderDTO })
  @ApiCreatedResponse({ type: MakeOrderResponseDTO })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async handle(@Body(new ZodValidationPipe(makeOrderSchema)) body: MakeOrderDTO) {
    const result = await this.makeOrderService.execute(body);

    if (result.isLeft()) throw result.value;

    return {
      id: result.value.order.id.toString(),
      items: result.value.order.items.map((item) => {
        return {
          id: item.id.toString(),
          quantity: item.quantity,
          productId: item.productId.toString(),
          unitPriceInCents: item.unitPrice.toJSON().amountInCents,
        };
      }),
      total: result.value.order.total.toJSON().amountInCents,
      status: result.value.order.status.current,
      createdAt: result.value.order.createdAt,
      updatedAt: result.value.order.updatedAt,
    };
  }
}
