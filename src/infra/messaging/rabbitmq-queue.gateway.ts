import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';

import { QueueErrorMessagesConsts } from '@/core/consts/queue.consts';
import { QueueError } from '@/domain/application/shared/errors/queue.error';
import { Queue, QueueMessage, QueueMessageHandler } from '@/domain/application/shared/gateways/queue';

/**
 * Implementação real de `Queue` sobre RabbitMQ, via
 * `@golevelup/nestjs-rabbitmq` (README, seção 8). Adapter: só este
 * arquivo conhece `AmqpConnection`/`amqplib` — o domínio continua
 * enxergando apenas o port `Queue`.
 *
 * Gestão de conexão/lifecycle (reconexão, etc.) é responsabilidade do
 * `RabbitMQModule` (ver `@/infra/messaging/messaging.module`), não desta
 * classe — ela só publica/consome através da conexão já gerenciada.
 */
@Injectable()
export class RabbitMqQueueGateway implements Queue {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  /**
   * Publica `message` em `exchange`. `messageId` vai na propriedade AMQP
   * nativa (não embutido no payload), e `persistent: true` garante que a
   * mensagem sobrevive a um restart do broker (obrigatório para eventos
   * de negócio — ver PRD `rabbitmq-infra-wiring`, seção "Requisitos
   * funcionais").
   *
   * Qualquer erro do client AMQP (`amqplib`/`amqp-connection-manager`) é
   * capturado e relançado como `QueueError` — nunca deixamos o erro cru
   * do client vazar para quem chama o port (ver JSDoc de `Queue.publish`).
   */
  async publish(exchange: string, message: QueueMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(exchange, message.routingKey, message.payload, {
        messageId: message.messageId,
        persistent: true,
      });
    } catch (error) {
      throw this.toQueueError(error, QueueErrorMessagesConsts.SEND_TO_QUEUE_ERROR);
    }
  }

  /**
   * Registra `handler` para `queueName` via `AmqpConnection.createSubscriber`
   * — o mesmo mecanismo que o decorator `@RabbitSubscribe` usa por baixo,
   * só que acionável em runtime. O binding fila↔exchange↔routingKey já
   * foi resolvido pela topologia de infra antes da entrega (ver JSDoc de
   * `Queue.consume`) — este método só traduz a entrega AMQP para
   * `QueueMessage` e repassa ao `handler`.
   *
   * Sem nenhuma fila real registrada neste projeto ainda (ver PRD
   * `rabbitmq-infra-wiring`, "Fora de escopo"), este caminho fica sem
   * cobertura de teste de integração — só o shape é implementado para
   * satisfazer o port.
   *
   * Erro lançado por `handler` (promise rejeitada) não é tratado aqui: a
   * lib já faz `nack` (redelivery) por padrão quando o handler lança —
   * comportamento default do `createSubscriber`, sem necessidade de
   * código extra.
   */
  async consume(queueName: string, handler: QueueMessageHandler): Promise<void> {
    try {
      await this.amqpConnection.createSubscriber<Record<string, unknown>>(
        async (payload, rawMessage) => {
          await handler({
            messageId: (rawMessage?.properties.messageId as string) ?? '',
            routingKey: rawMessage?.fields.routingKey ?? '',
            payload: payload ?? {},
          });
        },
        { queue: queueName },
        `RabbitMqQueueGateway.consume:${queueName}`,
      );
    } catch (error) {
      throw this.toQueueError(error, QueueErrorMessagesConsts.CONSUME_QUEUE_ERROR);
    }
  }

  /**
   * Converte um erro cru do client AMQP em `QueueError`, preservando a
   * causa original tanto na mensagem (concatenada, para quem só lê o
   * `.message`) quanto em `.cause` (para quem inspeciona a stack
   * completa durante debug) — ver PRD, "Requisitos funcionais".
   */
  private toQueueError(error: unknown, message: string): QueueError {
    const cause = error instanceof Error ? error.message : String(error);
    const queueError = new QueueError(`${message}: ${cause}`);

    if (error instanceof Error) {
      queueError.cause = error;
    }

    return queueError;
  }
}
