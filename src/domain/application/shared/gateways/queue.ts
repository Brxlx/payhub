/**
 * Mensagem publicada ou consumida através do gateway `Queue`. Representa o
 * contrato de "envelope" independente de broker (RabbitMQ, SQS, etc.).
 */
export interface QueueMessage<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  /**
   * Idempotência obrigatória (README, seção 8.4 — RabbitMQ garante
   * at-least-once delivery, nunca exactly-once). Quem publica reaproveita
   * o próprio id da linha de origem (ex.: o id da outbox event), nunca
   * fabrica um novo aqui — este tipo só exige que o campo exista, não diz
   * de onde ele vem.
   */
  messageId: string;

  /**
   * Routing key da mensagem (ex.: `ORDER_ROUTING_KEYS.PLACED`, de
   * `@/core/consts/messaging.consts`). Em `publish`, decide o roteamento
   * no exchange; em `consume`, é só metadado — o binding fila↔routingKey
   * já foi resolvido pela topologia de infra antes da entrega.
   */
  routingKey: string;

  /**
   * Dados de negócio, já serializados (ex.: `DomainEvent.toPayload()`).
   */
  payload: TPayload;
}

export type QueueMessageHandler<TPayload extends Record<string, unknown> = Record<string, unknown>> = (
  message: QueueMessage<TPayload>,
) => Promise<void>;

/**
 * Gateway para um broker de mensageria (RabbitMQ, na implementação real —
 * ver README, seção 8). Port: o domínio conhece apenas este contrato,
 * nunca `amqplib`/`@golevelup/nestjs-rabbitmq` diretamente.
 *
 * Deliberadamente fora deste contrato: gestão de conexão/lifecycle do
 * broker (`onModuleInit`/reconexão) — isso é detalhe de infraestrutura,
 * nunca algo que quem publica/consome precise orquestrar.
 */
export abstract class Queue {
  /**
   * Publica uma mensagem num exchange. `exchange` é parâmetro explícito
   * (não embutido em `QueueMessage`) para que o mesmo envelope sirva a
   * publishers de diferentes bounded contexts sem acoplar o tipo a um
   * exchange fixo.
   *
   * Deve lançar `QueueError` (nunca o erro cru do client AMQP) em caso de
   * falha — ver `@/domain/application/shared/errors/queue.error`.
   */
  abstract publish(exchange: string, message: QueueMessage): Promise<void>;

  /**
   * Registra um handler para mensagens entregues numa fila. O binding
   * fila↔exchange↔routingKey é responsabilidade da topologia de infra
   * (README, seção 8.1) — este método não recebe exchange/routingKey,
   * só o nome da fila já configurada.
   *
   * Retry/redelivery (`MAX_CONSUME_ATTEMPTS`, `CONSUME_QUEUE_TIMEOUT`,
   * ver `@/core/consts/queue.consts`) é decisão de cada implementação
   * concreta (nack + dead-letter exchange, no caso do RabbitMQ) — o port
   * não modela contagem de tentativas; um handler que rejeita (`throw`)
   * apenas sinaliza "esta entrega falhou".
   */
  abstract consume(queueName: string, handler: QueueMessageHandler): Promise<void>;
}
