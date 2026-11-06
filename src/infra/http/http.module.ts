import { Module } from '@nestjs/common';

import { OrderModule } from './modules/Order/order.module';

@Module({
  imports: [OrderModule],
})
export class HttpModule {}
