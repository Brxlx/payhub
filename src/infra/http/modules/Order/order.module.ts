import { Module } from '@nestjs/common';

import { DatabaseModule } from '@/infra/database/database.module';

import { CancelOrderController } from './cancel-order.controller';
import { CancelOrderService } from './cancel-order.service';
import { MakeOrderController } from './make-order.controller';
import { MakeOrderService } from './make-order.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MakeOrderController, CancelOrderController],
  providers: [MakeOrderService, CancelOrderService],
  exports: [MakeOrderService, CancelOrderService],
})
export class OrderModule {}
