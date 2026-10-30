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
- [ ] Endpoint HTTP (`POST /orders/:id/cancel`, README seção 14.1).
- [ ] Publicar `OrderCancelledEvent` no RabbitMQ (routing key
      `order.cancelled`, README seção 8.1) — depende do módulo de
      mensageria, que ainda não existe.

## Requisitos funcionais

- [x] Recebe `orderId: string`.
- [x] Valida `orderId` como `ID` (cuid2) válido.
- [x] Busca o pedido via `OrdersRepository.findById`.
- [x] Chama `order.cancel()`, traduzindo `OrderStatusError` (lançado por
      `OrderStatus.transitionTo`) em `OrderCannotBeCancelledError`.
- [x] Persiste via `OrdersRepository.update()`.
- [x] Retorna `Either<OrderNotFoundError | OrderCannotBeCancelledError,
      { order: Order }>`.

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
- [ ] Publisher real (RabbitMQ) e persistência na tabela de outbox — mesmo
      estágio pendente que `OrderPlacedEvent` em `create-order.md`.

## Arquivos envolvidos

- `src/domain/enterprise/entities/order.ts` (`cancel`)
- `src/domain/enterprise/entities/order.spec.ts`
- `src/domain/enterprise/entities/events/order-cancelled.event.ts`
- `src/domain/application/Order/use-cases/cancel-order-use-case.ts`
- `src/domain/application/Order/use-cases/cancel-order-use-case.spec.ts`
- `src/domain/application/Order/errors/order-cannot-be-cancelled.error.ts`
- `src/domain/application/Order/errors/order-not-found.error.ts`
  (reaproveitado de `delete-order`)

## Em aberto

- [ ] Endpoint HTTP `POST /orders/:id/cancel`.
- [ ] Persistência real via Drizzle (hoje só `InMemoryOrdersRepository`).
- [ ] Publisher do `OrderCancelledEvent` no RabbitMQ + escrita na tabela
      de outbox na mesma transação de `update`.
- [ ] Avaliar se o estorno de cobrança (quando `cancelledFrom === 'PLACED'`)
      deve ser orquestrado por este use case ou por um consumidor separado
      reagindo ao evento — hoje não há módulo de pagamentos implementado.
