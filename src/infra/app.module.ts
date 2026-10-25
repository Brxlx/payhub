import { Module } from '@nestjs/common';
import { EnvModule } from './shared/env/env.module';

@Module({
  imports: [EnvModule],
})
export class AppModule {}
