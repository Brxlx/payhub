import { UseCaseError } from '@/core/errors/use-case.error';

/**
 * Erro de integração: falha ao publicar ou consumir uma mensagem através
 * do gateway `Queue`. Não é invariante de nenhum agregado — por isso vive
 * em `application/shared/errors` (cross-bounded-context), não em
 * `enterprise/entities/errors`.
 *
 * Implementações concretas de `Queue` devem lançar este erro (usando as
 * mensagens de `@/core/consts/queue.consts`) em vez de deixar vazar o
 * erro cru do client do broker (ex.: `amqplib`) para quem chama o port.
 */
export class QueueError extends Error implements UseCaseError {
  constructor(message: string) {
    super(message);
    this.name = 'QueueError';
  }
}
