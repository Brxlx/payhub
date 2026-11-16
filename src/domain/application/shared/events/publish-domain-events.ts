import { ID } from '@/core/entities/id';
import { QueueError } from '@/domain/application/shared/errors/queue.error';
import { Logger } from '@/domain/application/shared/gateways/logger';
import { Queue } from '@/domain/application/shared/gateways/queue';

import { DomainEvent } from './domain-event';

/**
 * Publica `events` em `exchange`, um por um, na ordem em que aparecem.
 *
 * Usado por `MakeOrderUseCase`/`CancelOrderUseCase` depois que o agregado
 * já foi persistido com sucesso — ver `prds/publish-order-domain-events.md`
 * para o porquê da ordem "capturar eventos → persistir → publicar" (o
 * repositório limpa `order.domainEvents` como efeito colateral de
 * `create`/`update`, então os eventos precisam ser capturados pelo
 * chamador antes dessa chamada).
 *
 * Nunca publica em paralelo (`Promise.all`): a ordem de publicação segue
 * a ordem causal em que o agregado disparou os eventos.
 *
 * Falha ao publicar um evento (`QueueError`) nunca propaga para fora
 * desta função nem aborta a publicação dos eventos restantes — o pedido
 * já foi persistido com sucesso quando isto é chamado, então reportar a
 * operação inteira como falha (ou interromper os eventos seguintes por
 * causa de um que falhou) não faz sentido. Em vez disso, a falha é
 * registrada via `logger.error(...)` para não desaparecer sem rastro.
 */
export async function publishDomainEvents(
  queue: Queue,
  logger: Logger,
  exchange: string,
  events: readonly DomainEvent[],
): Promise<void> {
  for (const event of events) {
    try {
      await queue.publish(exchange, {
        messageId: new ID().toValue(),
        routingKey: event.eventName,
        payload: event.toPayload(),
      });
    } catch (error) {
      const queueError = error instanceof QueueError ? error : new QueueError((error as Error).message);

      logger.error(`Failed to publish domain event "${event.eventName}" to exchange "${exchange}"`, {
        eventName: event.eventName,
        exchange,
        aggregateId: event.getAggregateId().toValue(),
        cause: queueError.message,
      });
    }
  }
}
