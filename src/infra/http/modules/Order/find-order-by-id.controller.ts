import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';

import { ZodValidationPipe } from '../../pipes/zod-validation.pipe';
import { FindOrderByIdService } from './find-order-by-id.service';
import { OrderPresenter } from './presenters/order.presenter';
import { findOrderByIdParamsSchema } from './types/find-order-by-id.schema';
import { FindOrderByIdResponseDTO } from './types/order.dto';

@Controller('/orders')
export class FindOrderByIdController {
  constructor(private readonly findOrderByIdService: FindOrderByIdService) {}

  @ApiOperation({ summary: 'Find an order by id' })
  @ApiParam({ name: 'id', description: 'Order id' })
  @ApiOkResponse({ type: FindOrderByIdResponseDTO })
  @HttpCode(HttpStatus.OK)
  @Get(':id')
  async handle(@Param('id', new ZodValidationPipe(findOrderByIdParamsSchema.shape.id)) id: string) {
    const result = await this.findOrderByIdService.execute({ id });

    if (result.isLeft()) throw result.value;

    return OrderPresenter.toHTTP(result.value.order);
  }
}
