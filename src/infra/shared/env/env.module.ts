import { Module } from '@nestjs/common';
import { EnvService } from './env.service';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './env.schema';
import { CoreEnv } from '@/core/env';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: validateEnv,
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: ['.env'],
    }),
  ],
  providers: [{ provide: CoreEnv, useClass: EnvService }, EnvService],
  exports: [EnvService],
})
export class EnvModule {}
