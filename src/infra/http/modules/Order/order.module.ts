import { Module } from '@nestjs/common';

import { DatabaseModule } from '@/infra/database/database.module';

import { MakeOrderController } from './make-order.controller';
import { MakeOrderService } from './make-order.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MakeOrderController],
  providers: [MakeOrderService],
  exports: [MakeOrderService],
})
export class OrderModule {}
