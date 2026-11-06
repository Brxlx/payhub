import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';

import { ZodValidationPipe } from '@/infra/http/pipes/zod-validation.pipe';

import { CancelOrderService } from './cancel-order.service';
import { OrderPresenter } from './presenters/order.presenter';
import { cancelOrderParamsSchema } from './types/cancel-order.schema';
import { CancelOrderResponseDTO } from './types/order.dto';

@Controller('/orders')
export class CancelOrderController {
  constructor(private readonly cancelOrderService: CancelOrderService) {}

  @ApiOperation({ summary: 'Cancel an order' })
  @ApiParam({ name: 'id', description: 'Order id' })
  @ApiOkResponse({ type: CancelOrderResponseDTO })
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  async handle(@Param('id', new ZodValidationPipe(cancelOrderParamsSchema.shape.id)) id: string) {
    const result = await this.cancelOrderService.execute({ orderId: id });

    if (result.isLeft()) throw result.value;

    return OrderPresenter.toHTTP(result.value.order);
  }
}
