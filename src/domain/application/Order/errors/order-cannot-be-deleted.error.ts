import { UseCaseError } from '@/core/errors/use-case.error';

/**
 * Erro de aplicação retornado pelo `DeleteOrderUseCase` quando a regra de
 * negócio é violada: só pedidos em `DRAFT` ou `CANCELLED` podem passar por
 * soft delete (ver README, seção 6.2, e `Order.delete()`). Encapsula a
 * `OrderError` lançada pelo agregado, traduzindo-a para o vocabulário do
 * caso de uso em vez de vazar o erro de domínio bruto para fora.
 */
export class OrderCannotBeDeletedError extends Error implements UseCaseError {
  constructor(reason: string) {
    super(reason);
    this.name = 'OrderCannotBeDeletedError';
  }
}
