import { UseCaseError } from '@/core/errors/use-case.error';

/**
 * Erro de aplicação: nenhum pedido foi encontrado com o id informado. Não é
 * um erro de domínio (o agregado `Order` não existe para validar nada) —
 * por isso vive aqui, em `application/Order/errors`, e não em
 * `enterprise/entities/errors` (que reúne invariantes do próprio agregado).
 */
export class OrderNotFoundError extends Error implements UseCaseError {
  constructor(orderId: string) {
    super(`Order with id "${orderId}" was not found`);
    this.name = 'OrderNotFoundError';
  }
}
