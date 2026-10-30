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
- [ ] Rotina periódica de purge definitivo (> 30 dias) — já listada no
      roadmap do README, seção 15.
- [ ] Endpoint HTTP (`DELETE /orders/:id`, README seção 14.1).

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

## Regras de validação / erros

- [x] `orderId` inválido (não é cuid2) → `OrderNotFoundError`.
- [x] Pedido não encontrado → `OrderNotFoundError`.
- [x] Pedido com `status` `PLACED` → `OrderCannotBeDeletedError`.
- [x] Pedido já deletado (`isDeleted === true`) → `OrderCannotBeDeletedError`
      (via `Order.delete()`, que lança `OrderError('Order is already
      deleted')`).
- [x] Pedido `DRAFT` → soft delete permitido.
- [x] Pedido `CANCELLED` → soft delete permitido.

## Arquivos envolvidos

- `src/domain/enterprise/entities/order.ts` (`delete`, `isDeleted`,
  `deletedAt`)
- `src/domain/enterprise/entities/order.spec.ts`
- `src/domain/application/Order/use-cases/delete-order-use-case.ts`
- `src/domain/application/Order/use-cases/delete-order-use-case.spec.ts`
- `src/domain/application/Order/errors/order-not-found.error.ts`
- `src/domain/application/Order/errors/order-cannot-be-deleted.error.ts`
- `src/domain/application/Order/repositories/orders.repository.ts`
  (comentários explicando `update` vs `delete`)

## Em aberto

- [ ] Endpoint HTTP `DELETE /orders/:id`.
- [ ] Rotina periódica (worker ou job agendado) de purge definitivo para
      pedidos soft-deletados há mais de 30 dias (README seção 15) — hoje
      `OrdersRepository.delete()` existe no port mas não é chamado por
      nenhum use case.
- [ ] Persistência real via Drizzle de `OrdersRepository.update`/`delete`
      (hoje só `InMemoryOrdersRepository`).
- [ ] Decidir se consultas de listagem/busca (`FindManyOrdersUseCase`,
      `FindOrderByIdUseCase`) devem, por padrão, excluir pedidos
      soft-deletados em algum contexto de uso (hoje nenhum dos dois
      filtra por `deletedAt` — ver PRDs correspondentes).
