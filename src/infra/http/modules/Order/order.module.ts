import { Module } from '@nestjs/common';

import { DatabaseModule } from '@/infra/database/database.module';

import { CancelOrderController } from './cancel-order.controller';
import { CancelOrderService } from './cancel-order.service';
import { DeleteOrderController } from './delete-order.controller';
import { DeleteOrderService } from './delete-order.service';
import { MakeOrderController } from './make-order.controller';
import { MakeOrderService } from './make-order.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MakeOrderController, CancelOrderController, DeleteOrderController],
  providers: [MakeOrderService, CancelOrderService, DeleteOrderService],
  exports: [MakeOrderService, CancelOrderService, DeleteOrderService],
})
export class OrderModule {}
