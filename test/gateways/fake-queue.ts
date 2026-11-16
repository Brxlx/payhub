/* eslint-disable @typescript-eslint/require-await */
import { QueueErrorMessagesConsts } from '@/core/consts/queue.consts';
import { QueueError } from '@/domain/application/shared/errors/queue.error';
import { Queue, QueueMessage, QueueMessageHandler } from '@/domain/application/shared/gateways/queue';

/**
 * Double de `Queue` para uso em testes (unitários de use-case/worker, por
 * exemplo), sem subir um broker real.
 *
 * Estratégia deliberada: `consume` só registra o handler — não há
 * simulação de roteamento exchange/routingKey → fila como o AMQP real
 * faria (com wildcards `#`/`*` e tudo mais). A entrega para um handler
 * registrado é sempre disparada explicitamente pelo teste, via
 * `deliverTo`. Isso evita reimplementar topic-matching do zero para um
 * cenário que hoje não tem nenhum consumidor real no projeto para validar
 * contra — se isso mudar, reavaliar aqui (YAGNI por enquanto).
 */
export class FakeQueue implements Queue {
  /**
   * Histórico de publicações bem-sucedidas, na ordem em que ocorreram.
   * Testes de um futuro worker de outbox inspecionam isto diretamente.
   */
  public publishedMessages: Array<{ exchange: string; message: QueueMessage }> = [];

  private consumers = new Map<string, QueueMessageHandler>();
  private publishFailure: Error | null = null;

  async publish(exchange: string, message: QueueMessage): Promise<void> {
    if (this.publishFailure) {
      throw this.publishFailure;
    }

    this.publishedMessages.push({ exchange, message });
  }

  async consume(queueName: string, handler: QueueMessageHandler): Promise<void> {
    this.consumers.set(queueName, handler);
  }

  // --- Helpers de teste — não fazem parte do contrato do port `Queue` ---

  /**
   * Faz a próxima (e todas as subsequentes, até `clearPublishFailure`)
   * chamada a `publish` lançar `error`, para testar o caminho de erro de
   * quem publica (ex.: retry de um worker de outbox).
   */
  public setPublishFailure(
    error: Error = new QueueError(QueueErrorMessagesConsts.SEND_TO_QUEUE_ERROR),
  ): void {
    this.publishFailure = error;
  }

  public clearPublishFailure(): void {
    this.publishFailure = null;
  }

  /**
   * Entrega `message` ao handler registrado para `queueName` via
   * `consume`. Lança se nenhum handler foi registrado para essa fila —
   * sintoma de o teste estar simulando uma topologia que não configurou.
   */
  public async deliverTo(queueName: string, message: QueueMessage): Promise<void> {
    const handler = this.consumers.get(queueName);

    if (!handler) {
      throw new QueueError(`FakeQueue: no consumer registered for queue "${queueName}"`);
    }

    await handler(message);
  }

  public reset(): void {
    this.publishedMessages = [];
    this.consumers.clear();
    this.publishFailure = null;
  }
}
