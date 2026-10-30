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
- [x] Pedido já `CANCELLED` → `OrderCannotBeCancelledError` (única
      transição inválida possível, já que `CANCELLED` não tem saída —
      ver `ORDER_STATUS_TRANSITIONS`).

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
