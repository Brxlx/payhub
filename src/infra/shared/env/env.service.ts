import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CoreEnv } from '@/core/env';

import { Env } from './env.schema';

@Injectable()
export class EnvService implements CoreEnv<Env> {
  constructor(private readonly configService: ConfigService<Env, true>) {}

  public get<T extends keyof Env>(key: T): Env[T] {
    return this.configService.get(key, { infer: true });
  }
}
