import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CoreEnv } from '@/core/env';

import { validateEnv } from './env.schema';
import { EnvService } from './env.service';

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
