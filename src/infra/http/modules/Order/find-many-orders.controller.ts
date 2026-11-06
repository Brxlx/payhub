import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { ZodValidationPipe } from '@/infra/http/pipes/zod-validation.pipe';

import { FindManyOrdersService } from './find-many-orders.service';
import { OrderPresenter } from './presenters/order.presenter';
import { findManyOrdersQuerySchema } from './types/find-many-orders.schema';
import { FindManyOrdersResponseDTO } from './types/order.dto';

@Controller('/orders')
export class FindManyOrdersController {
  constructor(private readonly findManyOrdersService: FindManyOrdersService) {}

  @ApiOperation({ summary: 'List orders paginated' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'itemsPerPage', required: false })
  @ApiOkResponse({ type: FindManyOrdersResponseDTO })
  @HttpCode(HttpStatus.OK)
  @Get()
  async handle(
    @Query(new ZodValidationPipe(findManyOrdersQuerySchema)) query: { page?: number; itemsPerPage?: number },
  ) {
    const result = await this.findManyOrdersService.execute({
      page: query.page,
      itemsPerPage: query.itemsPerPage,
    });

    if (result.isLeft()) throw result.value;

    return {
      orders: result.value.orders.map(OrderPresenter.toHTTP),
      total: result.value.total,
      page: result.value.page,
      itemsPerPage: result.value.itemsPerPage,
      hasMore: result.value.hasMore,
    };
  }
}
