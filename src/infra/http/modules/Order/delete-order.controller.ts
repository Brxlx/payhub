import { Controller, Delete, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';

import { ZodValidationPipe } from '@/infra/http/pipes/zod-validation.pipe';

import { DeleteOrderService } from './delete-order.service';
import { OrderPresenter } from './presenters/order.presenter';
import { deleteOrderParamsSchema } from './types/delete-order.schema';
import { DeleteOrderResponseDTO } from './types/order.dto';

@Controller('/orders')
export class DeleteOrderController {
  constructor(private readonly deleteOrderService: DeleteOrderService) {}

  @ApiOperation({ summary: 'Soft delete an order' })
  @ApiParam({ name: 'id', description: 'Order id' })
  @ApiOkResponse({ type: DeleteOrderResponseDTO })
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  async handle(@Param('id', new ZodValidationPipe(deleteOrderParamsSchema.shape.id)) id: string) {
    const result = await this.deleteOrderService.execute({ orderId: id });

    if (result.isLeft()) throw result.value;

    return OrderPresenter.toHTTP(result.value.order);
  }
}
