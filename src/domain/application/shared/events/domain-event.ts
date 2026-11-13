import { ID } from '@/core/entities/id';

export interface DomainEvent {
  ocurredAt: Date;

  /**
   * Identificador estável de roteamento (ex.: `'order.placed'`), usado
   * para preencher a coluna `event_type` da outbox e, depois, a routing
   * key publicada no RabbitMQ (ver README, seção 8.1). Propositalmente
   * não usamos `event.constructor.name` para isso: nome de classe é
   * frágil sob minificação/refactor e nunca deveria vazar como contrato
   * de integração externa. Cada evento concreto deve atribuir este valor
   * a partir de uma constante em `@/core/consts/messaging.consts.ts`,
   * nunca uma string literal solta.
   */
  eventName: string;

  getAggregateId(): ID;

  /**
   * Serializa apenas os dados de negócio do evento, em formato JSON-safe
   * (sem vazar instâncias cruas de Value Objects). Não inclui `eventName`,
   * `ocurredAt` ou o id do agregado — esses já são colunas próprias da
   * outbox; repeti-los aqui dentro do payload seria duplicação sem ganho.
   *
   * Quem monta a linha da outbox (infra, fora deste contrato) é
   * responsável por preencher `aggregateType` — este contrato não exige
   * que o evento se auto-declare, porque hoje cada implementação de
   * repositório já lida com um único tipo de agregado por vez (decisão
   * deliberada: ver plano de mensageria no histórico do projeto).
   */
  toPayload(): Record<string, unknown>;
}
