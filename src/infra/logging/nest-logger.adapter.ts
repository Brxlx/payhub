import { Injectable, Logger as NestLogger } from '@nestjs/common';

import { Logger } from '@/domain/application/shared/gateways/logger';
import { prefixedLogger } from '@/infra/helpers/prefixed-logger';
import { EnvService } from '@/infra/shared/env/env.service';

/**
 * Implementação real de `Logger` sobre o `Logger` do próprio NestJS, via
 * `prefixedLogger` (mesmo helper usado por `DrizzleService`/`App`, para
 * manter o mesmo formato de log do resto da infra).
 *
 * Importa `Logger` do `@nestjs/common` como `NestLogger` para não colidir
 * com o `Logger` (port) de
 * `@/domain/application/shared/gateways/logger`, que esta classe
 * implementa.
 */
@Injectable()
export class NestLoggerAdapter implements Logger {
  private readonly logger: NestLogger;

  constructor(envService: EnvService) {
    this.logger = prefixedLogger(envService.get('NODE_ENV'), NestLoggerAdapter.name);
  }

  /**
   * `meta`, quando presente, é serializado (`JSON.stringify`, com
   * indentação) e anexado após a mensagem — a API do `Logger` do Nest
   * (`error(message, trace?, context?)`) não tem um parâmetro
   * estruturado para metadata arbitrária, e um blob JSON numa linha só
   * seria ilegível em produção.
   */
  error(message: string, meta?: Record<string, unknown>): void {
    if (!meta) {
      this.logger.error(message);
      return;
    }

    this.logger.error(`${message}\n${JSON.stringify(meta, null, 2)}`);
  }
}
