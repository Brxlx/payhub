import { Module } from '@nestjs/common';

import { OrdersRepository } from '@/domain/application/Order/repositories/orders.repository';

import { EnvModule } from '../shared/env/env.module';
import { EnvService } from '../shared/env/env.service';
import { DrizzleService } from './drizzle/drizzle.service';
import { DrizzleOrdersRepository } from './drizzle/repositories/drizzle-orders.repository';

@Module({
  imports: [EnvModule],
  providers: [
    {
      provide: DrizzleService,
      useFactory: async (envService: EnvService) => {
        const drizzleService = new DrizzleService(envService);
        if (await drizzleService.isHealthy()) {
          return new DrizzleService(envService);
        }
        throw new Error('Database connection is not healthy');
      },
      inject: [EnvService],
    },
    {
      provide: OrdersRepository,
      useClass: DrizzleOrdersRepository,
    },
  ],
  exports: [DrizzleService, OrdersRepository],
})
export class DatabaseModule {}
