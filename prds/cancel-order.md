# PRD — Cancelar Pedido (Cancel Order)

## Contexto / regra de negócio

Cancela um pedido, seja ele `DRAFT` (nunca confirmado) ou `PLACED` (já
confirmado) — a transição para `CANCELLED` é terminal, não existe volta.

Este use case nasceu de uma lacuna identificada durante a revisão da
camada de domínio: `MakeOrderUseCase` sempre cria **e** confirma
(`place()`) o pedido na mesma operação — não existe fluxo de aplicação que
deixe um pedido em `DRAFT`. Sem um `CancelOrderUseCase`, nenhum pedido
real jamais alcançaria `CANCELLED`, e por extensão a regra de
`DeleteOrderUseCase` ("só `DRAFT`/`CANCELLED` podem ser deletados") era
inalcançável na prática para qualquer pedido criado via API.

## Escopo

- [x] Cancelar um pedido `DRAFT` ou `PLACED` (transição para `CANCELLED`
      via `Order.cancel()`).
- [x] Janela de cancelamento de 1h para pedidos `PLACED` (ver nota abaixo).
- [x] Disparar `OrderCancelledEvent` ao cancelar (ver nota abaixo).
- [x] Impedir cancelamento de um pedido já soft-deletado (ver seção
      dedicada abaixo — regra adicionada depois do escopo inicial, durante
      testes manuais do fluxo HTTP ponta-a-ponta).
- [x] Endpoint HTTP (`POST /orders/:id/cancel`, README seção 14.1).
- [x] Persistência real via Drizzle (`DrizzleOrdersRepository.update`).
- [ ] Publicar `OrderCancelledEvent` no RabbitMQ (routing key
      `order.cancelled`, README seção 8.1) — depende do módulo de
      mensageria, que ainda não existe.

## Requisitos funcionais

- [x] Recebe `orderId: string`.
- [x] Valida `orderId` como `ID` (cuid2) válido.
- [x] Busca o pedido via `OrdersRepository.findById`.
- [x] Chama `order.cancel()`, traduzindo `OrderStatusError` (lançado por
      `OrderStatus.transitionTo`) e `OrderError` (lançado pelo próprio
      `Order.cancel()`) em `OrderCannotBeCancelledError`.
- [x] Persiste via `OrdersRepository.update()`.
- [x] Retorna `Either<OrderNotFoundError | OrderCannotBeCancelledError,
      { order: Order }>`.

### Camada HTTP

- [x] `POST /orders/:id/cancel`, `200 OK` (não `201` — não é criação de
      recurso).
- [x] Validação do path param `id` via Zod (`cancelOrderParamsSchema`,
      mesmo padrão de `ID.isValid()` do `customerId` de `create-order`).
- [x] Resposta serializada via `OrderPresenter.toHTTP` (mesmo shape
      reaproveitado de `create-order`/`soft-delete-order`).
- [x] `OrderNotFoundError` → `404`; `OrderCannotBeCancelledError` → `409`
      (`use-case-error.filter.ts`) — recurso existe, mas o estado atual
      não permite a transição (já cancelado, já deletado, ou janela de 1h
      expirada).

## Regras de validação / erros

- [x] `orderId` inválido (não é cuid2) → `OrderNotFoundError`.
- [x] Pedido não encontrado → `OrderNotFoundError`.
- [x] Pedido `DRAFT` → cancelamento permitido.
- [x] Pedido `PLACED` → cancelamento permitido.
- [x] Pedido já `CANCELLED` → `OrderCannotBeCancelledError` (via
      `OrderStatusError`, já que `CANCELLED` não tem saída — ver
      `ORDER_STATUS_TRANSITIONS`).
- [x] Pedido `PLACED` há mais de 1h → `OrderCannotBeCancelledError` (via
      `OrderError`, lançado por `Order.cancel()`/
      `assertWithinCancellationWindow` — regra de negócio, não se aplica
      a `DRAFT`, que não tem `placedAt`).
- [x] Pedido já soft-deletado (`isDeleted === true`) →
      `OrderCannotBeCancelledError` (via novo guard em `Order.cancel()` —
      ver seção abaixo).

## Guard contra cancelamento de pedido deletado

Ao testar o fluxo HTTP ponta-a-ponta manualmente, identificamos que
`Order.cancel()` não verificava `isDeleted`: um pedido `DRAFT`
soft-deletado ainda conseguia transicionar para `CANCELLED`, mesmo já
estando "arquivado" pelo soft delete. Decisão tomada: soft delete é
terminal — nenhuma mutação de estado deveria ser permitida depois dele, a
exemplo do guard equivalente que `Order.delete()` já tinha para si mesmo
(`'Order is already deleted'`).

Corrigido adicionando, no topo de `Order.cancel()`:

```ts
if (this.isDeleted) {
  throw new OrderError('Cannot cancel a deleted order');
}
```

Esse guard só se tornou **observável** depois de outra correção
relacionada: `DrizzleOrdersRepository.findById` originalmente filtrava
`isNull(orders.deletedAt)`, então um pedido deletado simplesmente "não
existia" para `findById` — o `CancelOrderUseCase` nunca alcançava o guard,
retornando `OrderNotFoundError` (404) em vez do `OrderCannotBeCancelledError`
(409) semanticamente correto. `findById` foi corrigido para não filtrar
soft-deleted (ver detalhes e motivação completa em
`prds/soft-delete-order.md` e `prds/find-order-by-id.md`).

- [x] Guard adicionado em `Order.cancel()`.
- [x] Teste de domínio em `order.spec.ts`
      (`'should not allow cancelling a deleted order'`).
- [x] Teste de use case em `cancel-order-use-case.spec.ts`
      (`'should not cancel a deleted order'`).

## Janela de cancelamento (1h)

Pedidos `PLACED` só podem ser cancelados dentro de `ORDER_CANCELLATION_WINDOW_MS`
(1h) a partir de `placedAt`. Motivo de negócio: depois desse prazo o
pedido já pode estar em processamento (cobrança/envio), então um
cancelamento simples deixa de ser seguro — precisaria virar um fluxo de
reembolso/devolução, que ainda não existe neste domínio (sem módulo de
pagamentos/fulfillment). Não se aplica a `DRAFT` (nunca confirmado, sem
`placedAt`, sem limite de tempo).

Considerado e descartado, por enquanto: bloquear cancelamento de pedidos
que já dispararam notificação. Notificar o cliente não deveria travar o
cancelamento (é só um aviso; cancelar depois só dispara outra
notificação) — o que de fato importa é estado de pagamento/envio, que
pertence a outro bounded context, ainda inexistente.

- [x] `placedAt?: Date | null` em `OrderProps`, setado em `place()`.
- [x] `Order.cancel()` valida a janela apenas quando `cancelledFrom ===
      'PLACED'`.
- [ ] Módulo de Pagamentos/Fulfillment, que eventualmente decidiria se um
      cancelamento fora da janela ainda é possível via fluxo de
      reembolso/devolução (fora do escopo deste use case).

## `OrderCancelledEvent`

Novo domain event, espelhando `OrderPlacedEvent`. Carrega `orderId`,
`customerId` e `cancelledFrom` (o status anterior à transição — `DRAFT` ou
`PLACED`), pensado para o consumidor eventualmente decidir se precisa
estornar uma cobrança (só relevante se `cancelledFrom === 'PLACED'`).
Atende à topologia já documentada no README (seção 8.1): routing key
`order.cancelled` → queue `notifications.order-cancelled`.

- [x] `OrderCancelledEvent` criado em
      `domain/enterprise/entities/events/order-cancelled.event.ts`.
- [x] `Order.cancel()` captura o status anterior e dispara o evento.
- [x] `DrizzleOrdersRepository.update` chama
      `DomainEvents.dispatchEventsForAggregate(order.id)` após persistir,
      disparando o evento para os handlers registrados.
- [ ] Publisher real (RabbitMQ) e persistência na tabela de outbox — mesmo
      estágio pendente que `OrderPlacedEvent` em `create-order.md`.

## Arquivos envolvidos

### Domínio

- `src/domain/enterprise/entities/order.ts` (`cancel`)
- `src/domain/enterprise/entities/order.spec.ts`
- `src/domain/enterprise/entities/events/order-cancelled.event.ts`
- `src/domain/application/Order/use-cases/cancel-order-use-case.ts`
- `src/domain/application/Order/use-cases/cancel-order-use-case.spec.ts`
- `src/domain/application/Order/errors/order-cannot-be-cancelled.error.ts`
- `src/domain/application/Order/errors/order-not-found.error.ts`
  (reaproveitado de `delete-order`)

### Infra (persistência)

- `src/infra/database/drizzle/repositories/drizzle-orders.repository.ts`
  (`findById`, `update`)

### Infra (HTTP)

- `src/infra/http/modules/Order/cancel-order.controller.ts`
- `src/infra/http/modules/Order/cancel-order.service.ts`
- `src/infra/http/modules/Order/types/cancel-order.schema.ts`
- `src/infra/http/modules/Order/types/order.dto.ts`
- `src/infra/http/modules/Order/presenters/order.presenter.ts`
  (reaproveitado de `create-order`)
- `src/infra/http/modules/Order/order.module.ts`
- `src/infra/http/pipes/zod-validation.pipe.ts` (fix: usa `metadata.data`
  como fallback de path quando o schema valida um campo isolado, ex.:
  `@Param('id', pipe)` — sem isso, o erro de validação do `id` vinha sem
  identificar o campo, ver `prds/soft-delete-order.md`)
- `src/infra/http/filters/use-case-error.filter.ts`

## Em aberto

- [ ] Publisher do `OrderCancelledEvent` no RabbitMQ + escrita na tabela
      de outbox na mesma transação de `update`.
- [ ] Avaliar se o estorno de cobrança (quando `cancelledFrom === 'PLACED'`)
      deve ser orquestrado por este use case ou por um consumidor separado
      reagindo ao evento — hoje não há módulo de pagamentos implementado.
- [ ] `cancelOrderResponseSchema` duplica o mesmo shape de
      `makeOrderResponseSchema`/`deleteOrderResponseSchema` — decisão
      deliberada por ora, extrair quando mais endpoints existirem.
