/**
 * Gateway para observabilidade (log) de problemas que acontecem fora do
 * fluxo normal de retorno de um use case — hoje, o único caso real é uma
 * falha ao publicar um domain event na `Queue` (ver
 * `@/domain/application/shared/events/publish-domain-events`): o use case
 * não propaga esse erro como resultado da `execute()` (o pedido já foi
 * persistido com sucesso), mas também não pode simplesmente engolir a
 * falha em silêncio — precisa de algum jeito de registrá-la.
 *
 * Port: o domínio conhece apenas este contrato mínimo, nunca um logger
 * concreto (Pino, Winston, o `Logger` do próprio Nest, etc.) — isso é
 * detalhe de infraestrutura, implementado depois.
 *
 * Deliberadamente mínimo (YAGNI): só `error`. Não há `info`/`warn`/`debug`
 * porque nenhum use case precisa deles hoje — se essa necessidade
 * aparecer, adicionar o método correspondente então.
 */
export abstract class Logger {
  /**
   * Registra uma falha. `meta` carrega contexto estruturado (ex.: o
   * `eventName` e `messageId` do evento que falhou ao publicar) — nunca
   * deve ser usado para esconder a mensagem principal, que já descreve o
   * problema em texto livre.
   */
  abstract error(message: string, meta?: Record<string, unknown>): void;
}
