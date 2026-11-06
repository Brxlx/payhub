import { Module } from '@nestjs/common';

import { DatabaseModule } from '@/infra/database/database.module';

import { CancelOrderController } from './cancel-order.controller';
import { CancelOrderService } from './cancel-order.service';
import { DeleteOrderController } from './delete-order.controller';
import { DeleteOrderService } from './delete-order.service';
import { FindManyOrdersController } from './find-many-orders.controller';
import { FindManyOrdersService } from './find-many-orders.service';
import { FindOrderByIdController } from './find-order-by-id.controller';
import { FindOrderByIdService } from './find-order-by-id.service';
import { MakeOrderController } from './make-order.controller';
import { MakeOrderService } from './make-order.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    MakeOrderController,
    FindOrderByIdController,
    FindManyOrdersController,
    CancelOrderController,
    DeleteOrderController,
  ],
  providers: [
    MakeOrderService,
    CancelOrderService,
    DeleteOrderService,
    FindOrderByIdService,
    FindManyOrdersService,
  ],
  exports: [
    MakeOrderService,
    FindOrderByIdService,
    FindManyOrdersService,
    CancelOrderService,
    DeleteOrderService,
  ],
})
export class OrderModule {}
