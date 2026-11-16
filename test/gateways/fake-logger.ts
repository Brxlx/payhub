import { Logger } from '@/domain/application/shared/gateways/logger';

/**
 * Double de `Logger` para uso em testes — coleta as chamadas a `error` em
 * vez de escrever em qualquer lugar, para que o teste possa inspecionar o
 * que foi (ou não foi) logado.
 */
export class FakeLogger implements Logger {
  public errors: Array<{ message: string; meta?: Record<string, unknown> }> = [];

  error(message: string, meta?: Record<string, unknown>): void {
    this.errors.push({ message, meta });
  }

  public reset(): void {
    this.errors = [];
  }
}
