# PRD — Deletar Pedido (Soft Delete)

## Contexto / regra de negócio

Pedidos nunca são removidos fisicamente do banco. "Deletar" um pedido é um
soft delete: marca `deletedAt`, nunca apaga a linha. Só pedidos `DRAFT`
(nunca confirmados) ou `CANCELLED` (já terminais) podem ser deletados — um
pedido `PLACED` já pode ter disparado efeitos colaterais confirmados
(outbox, mensageria, cobrança), então apagá-lo quebraria rastreabilidade;
precisa ser cancelado antes.

A remoção física definitiva é responsabilidade de uma rotina de purge
futura (pedidos soft-deletados há mais de 30 dias), não deste use case.

## Escopo

- [x] Soft delete de um pedido via `Order.delete()` (invariante de
      domínio).
- [x] Orquestração via `DeleteOrderUseCase` (busca, valida, persiste).
- [x] Endpoint HTTP (`DELETE /orders/:id`, README seção 14.1).
- [x] Persistência real via Drizzle (`DrizzleOrdersRepository.update`).
- [x] Decisão final sobre visibilidade de pedidos soft-deletados em
      consultas (ver seção dedicada abaixo).
- [ ] Rotina periódica de purge definitivo (> 30 dias) — já listada no
      roadmap do README, seção 15.

## Requisitos funcionais

### Domínio (`Order`)

- [x] `deletedAt?: Date | null` nas `OrderProps`.
- [x] `isDeleted: boolean` (getter derivado de `deletedAt != null`).
- [x] `Order.delete()`:
  - [x] Permite soft delete apenas quando `status` é `DRAFT` ou
        `CANCELLED`.
  - [x] Marca `deletedAt = new Date()` e atualiza `updatedAt` (via
        `touch()`).
  - [x] Não altera o `status` do pedido.

### Use case (`DeleteOrderUseCase`)

- [x] Recebe `orderId: string`.
- [x] Valida `orderId` como `ID` (cuid2) válido.
- [x] Busca o pedido via `OrdersRepository.findById`.
- [x] Chama `order.delete()`, traduzindo `OrderError` em
      `OrderCannotBeDeletedError`.
- [x] Persiste via `OrdersRepository.update()` — **nunca** via
      `OrdersRepository.delete()` (esse método fica reservado para a
      futura rotina de purge).
- [x] Retorna `Either<OrderNotFoundError | OrderCannotBeDeletedError,
      { order: Order }>`.

### Camada HTTP

- [x] `DELETE /orders/:id`, `200 OK` (retorna o pedido atualizado com
      `deletedAt` preenchido, em vez de `204 No Content`).
- [x] Validação do path param `id` via Zod (`deleteOrderParamsSchema`,
      mesmo padrão de `cancel-order`/`create-order`).
- [x] Resposta serializada via `OrderPresenter.toHTTP`, que passou a
      incluir `deletedAt` (antes só tinha `id`, `customerId`, `items`,
      `total`, `status`, `createdAt`, `updatedAt` — sem `deletedAt` não
      havia como o cliente da API confirmar que o soft delete aconteceu).
      `make-order.schema.ts` e `cancel-order.schema.ts` também passaram a
      incluir `deletedAt` nos seus response schemas por consistência.
- [x] `OrderNotFoundError` → `404`; `OrderCannotBeDeletedError` → `409`
      (`use-case-error.filter.ts`).

## Regras de validação / erros

- [x] `orderId` inválido (não é cuid2) → `OrderNotFoundError`.
- [x] Pedido não encontrado → `OrderNotFoundError`.
- [x] Pedido com `status` `PLACED` → `OrderCannotBeDeletedError`.
- [x] Pedido já deletado (`isDeleted === true`) → `OrderCannotBeDeletedError`
      (via `Order.delete()`, que lança `OrderError('Order is already
      deleted')`).
- [x] Pedido `DRAFT` → soft delete permitido.
- [x] Pedido `CANCELLED` → soft delete permitido.

## Bug encontrado e corrigido: `findById` escondia pedidos já deletados

Ao testar manualmente o fluxo HTTP, deletar um pedido já deletado
retornava `404 Order not found` em vez do `409 Order is already deleted`
esperado. Causa raiz: `DrizzleOrdersRepository.findById` filtrava
`isNull(orders.deletedAt)`, então um pedido soft-deletado simplesmente
"não existia" mais para `findById` — o `DeleteOrderUseCase` nunca
alcançava o guard de `Order.delete()` que produz a mensagem correta.

Esse comportamento também divergia do contrato já estabelecido pelos
testes: tanto `InMemoryOrdersRepository.findById` (usado nos testes de
use case) quanto o spec de `FindOrderByIdUseCase` (`'should find an order
that has been soft-deleted'`, em `prds/find-order-by-id.md`) já assumiam
que `findById` encontra o pedido independente de `deletedAt`.

**Decisão final de visibilidade** (resolve o item que estava em aberto
aqui e em `find-order-by-id.md`):

- `findById` — **não filtra** `deletedAt`. Uma busca direta por id
  (`GET /orders/:id`, `DeleteOrderUseCase`, `CancelOrderUseCase`) precisa
  continuar encontrando o pedido mesmo deletado — é o que permite tanto
  exibir detalhes de um pedido antigo quanto aplicar corretamente os
  guards de domínio (`'Order is already deleted'`,
  `'Cannot cancel a deleted order'` — ver `prds/cancel-order.md`).
- `findManyWithFilters` — **continua filtrando** `isNull(orders.deletedAt)`.
  Listagens/paginação escondem pedidos soft-deletados — eles não devem
  aparecer "navegando" pela lista, só quando buscados diretamente por id.

- [x] `DrizzleOrdersRepository.findById` corrigido (não filtra mais
      `deletedAt`).
- [x] `DrizzleOrdersRepository.findManyWithFilters` mantém o filtro.

## Arquivos envolvidos

### Domínio

- `src/domain/enterprise/entities/order.ts` (`delete`, `isDeleted`,
  `deletedAt`)
- `src/domain/enterprise/entities/order.spec.ts`
- `src/domain/application/Order/use-cases/delete-order-use-case.ts`
- `src/domain/application/Order/use-cases/delete-order-use-case.spec.ts`
- `src/domain/application/Order/errors/order-not-found.error.ts`
- `src/domain/application/Order/errors/order-cannot-be-deleted.error.ts`
- `src/domain/application/Order/repositories/orders.repository.ts`
  (comentários explicando `update` vs `delete`)

### Infra (persistência)

- `src/infra/database/drizzle/repositories/drizzle-orders.repository.ts`
  (`findById` — fix do filtro de `deletedAt`; `update`)

### Infra (HTTP)

- `src/infra/http/modules/Order/delete-order.controller.ts`
- `src/infra/http/modules/Order/delete-order.service.ts`
- `src/infra/http/modules/Order/types/delete-order.schema.ts`
- `src/infra/http/modules/Order/types/order.dto.ts`
- `src/infra/http/modules/Order/presenters/order.presenter.ts` (adição do
  campo `deletedAt`)
- `src/infra/http/modules/Order/order.module.ts`
- `src/infra/http/pipes/zod-validation.pipe.ts` (fix: usa `metadata.data`
  como fallback de path quando o schema valida um campo isolado, ex.:
  `@Param('id', pipe)` — sem isso, erro de validação de `id` inválido
  vinha como `": Invalid input"` em vez de `"id: Invalid ID"`)
- `src/infra/http/filters/use-case-error.filter.ts`

## Dependência resolvida

- [x] Existe agora um caminho real até `CANCELLED`/`DRAFT` persistido:
      `CancelOrderUseCase` (ver `prds/cancel-order.md`). Antes dele, nenhum
      pedido criado via `MakeOrderUseCase` (que sempre nasce `PLACED`)
      conseguia alcançar um estado deletável — a regra deste use case era
      inalcançável na prática.

## Em aberto

- [ ] Rotina periódica (worker ou job agendado) de purge definitivo para
      pedidos soft-deletados há mais de 30 dias (README seção 15) — hoje
      `OrdersRepository.delete()` existe no port e no `DrizzleOrdersRepository`
      (remoção física, com cascade em `order_items`) mas não é chamado por
      nenhum use case.
- [ ] `deleteOrderResponseSchema` duplica o mesmo shape de
      `makeOrderResponseSchema`/`cancelOrderResponseSchema` — decisão
      deliberada por ora, extrair quando mais endpoints existirem.
