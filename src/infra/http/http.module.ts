import { Module } from '@nestjs/common';

import { EnvModule } from '../shared/env/env.module';
import { OrderModule } from './modules/Order/order.module';

@Module({
  imports: [EnvModule, OrderModule],
})
export class HttpModule {}
