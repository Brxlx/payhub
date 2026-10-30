import { UseCaseError } from '@/core/errors/use-case.error';

/**
 * Erro de aplicação retornado pelo `CancelOrderUseCase` quando a transição
 * de status é invalida pelo próprio agregado (`OrderStatus.canTransitionTo`
 * / `Order.cancel()`) — hoje, na prática, só ocorre ao tentar cancelar um
 * pedido já `CANCELLED` (ver `ORDER_STATUS_TRANSITIONS`). Encapsula o
 * `OrderStatusError` lançado pelo domínio, traduzindo-o para o vocabulário
 * do caso de uso em vez de vazar o erro de domínio bruto para fora.
 */
export class OrderCannotBeCancelledError extends Error implements UseCaseError {
  constructor(reason: string) {
    super(reason);
    this.name = 'OrderCannotBeCancelledError';
  }
}
