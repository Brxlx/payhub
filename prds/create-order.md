# PRD — Criar Pedido (Create Order)

## Contexto / regra de negócio

PayHub não se comporta como carrinho de compras: um pedido não tem um estado
intermediário de "rascunho salvo" exposto pela API. O pedido chega completo
em uma única chamada e é criado e confirmado (`place()`) juntos, na mesma
operação.

## Escopo

- [x] Criar um `Order` a partir de `customerId` e uma lista de itens.
- [x] Confirmar o pedido (`DRAFT` → `PLACED`) como parte da mesma operação.
- [x] Persistência real via Drizzle (`DrizzleOrdersRepository.create`),
      gravando `orders` + `order_items` na mesma transação (README seção
      6.3).
- [x] Endpoint HTTP (`POST /orders`, README seção 14).
- [ ] Gravar o evento `OrderPlacedEvent` na tabela de outbox, na mesma
      transação (ver README seção 8.3 — Transactional Outbox). A tabela
      `outbox_events` ainda não existe; segue como `TODO` explícito em
      `DrizzleOrdersRepository.create` e `MakeOrderUseCase.persistOrder`.
- [ ] Publicar `OrderPlacedEvent` no RabbitMQ (exchange `orders.events`,
      routing key `order.placed`) — depende do módulo de mensageria, que
      ainda não existe (README seção 8).

## Requisitos funcionais

- [x] Recebe `customerId: string` e `items: { productId, quantity,
      unitPriceInCents }[]`.
- [x] Valida `customerId` como `ID` (cuid2) válido.
- [x] Rejeita lista de itens vazia.
- [x] Constrói cada `OrderItem` (dispara as invariantes do agregado — ver
      seção de validação abaixo).
- [x] Constrói o `Order` e chama `order.place()`, o que:
  - [x] Exige ao menos um item (garantido via `Order.create`, que já falha
        antes se `items.length === 0`).
  - [x] Transiciona `DRAFT` → `PLACED` via `OrderStatus.transitionTo`.
  - [x] Adiciona `OrderPlacedEvent` aos domain events do agregado.
- [x] Persiste via `OrdersRepository.create(order)`.
- [x] Retorna `Either<OrderError, { order: Order }>` — nunca deixa exceção
      de domínio vazar do use case.
- [x] Mapper dedicado (`OrderMapper.toPersistence`/`toDomain`) isola o
      shape relacional (`orders`/`order_items`) do shape do agregado — não
      existe `restore()` separado: `Order.create`/`OrderItem.create`
      servem tanto para criar quanto para hidratar vindo do banco.

### Camada HTTP

- [x] `POST /orders`, `201 Created`.
- [x] Validação do corpo via Zod (`makeOrderSchema`): `customerId` e
      `productId` de cada item validados como cuid2 (`ID.isValid()`),
      `quantity`/`unitPriceInCents` como inteiros positivos, `items` com
      `.min(1)`.
- [x] Resposta serializada via `OrderPresenter.toHTTP` — shape único
      reaproveitado por `cancel-order` e `soft-delete-order`: `id`,
      `customerId`, `items[]`, `total`, `status`, `createdAt`, `updatedAt`,
      `deletedAt` (datas sempre em ISO 8601, `null` quando não aplicável).
- [x] `OrderError` (qualquer erro de validação/domínio deste use case)
      mapeado para `400 Bad Request` (`use-case-error.filter.ts`).

## Regras de validação / erros

Todas as invariantes abaixo são capturadas em `buildOrder` e convertidas em
`OrderError` (use case nunca deixa `OrderItemError`/`MoneyError` vazarem):

- [x] `customerId` inválido (não é cuid2) → erro antes mesmo de montar o
      pedido.
- [x] `items` vazio → erro antes de montar o pedido.
- [x] `productId` de algum item inválido (não é cuid2) — validado dentro de
      `OrderItem.create` (`assertValidProductId`).
- [x] `quantity` não é inteiro positivo — validado dentro de
      `OrderItem.create` (`assertValidQuantity`).
- [x] `unitPriceInCents` não é inteiro não-negativo — validado em
      `Money.fromCents`.

## Arquivos envolvidos

### Domínio

- `src/domain/application/Order/use-cases/make-order-use-case.ts`
- `src/domain/application/Order/use-cases/make-order-use-case.spec.ts`
- `src/domain/enterprise/entities/order.ts` (`Order.create`, `Order.place`)
- `src/domain/enterprise/entities/order-item.ts` (`OrderItem.create`,
  `assertValidProductId`, `assertValidQuantity`)
- `src/domain/enterprise/entities/value-objects/money.vo.ts`
  (`Money.fromCents`)
- `src/domain/application/Order/repositories/orders.repository.ts`
  (`OrdersRepository.create`)

### Infra (persistência)

- `src/infra/database/drizzle/schemas/order.schema.ts`
- `src/infra/database/drizzle/schemas/order-item.schema.ts`
- `src/infra/database/drizzle/schemas/index.ts`
- `src/infra/database/drizzle/migrations/0000_create-orders.sql`
- `src/infra/database/drizzle/drizzle.service.ts`
- `src/infra/database/database.module.ts`
- `src/infra/database/drizzle/mappers/order.mapper.ts` (`toPersistence`,
  `toDomain`)
- `src/infra/database/drizzle/repositories/drizzle-orders.repository.ts`
  (`create`)

### Infra (HTTP)

- `src/infra/http/modules/Order/make-order.controller.ts`
- `src/infra/http/modules/Order/make-order.service.ts`
- `src/infra/http/modules/Order/types/make-order.schema.ts`
- `src/infra/http/modules/Order/types/order.dto.ts`
- `src/infra/http/modules/Order/presenters/order.presenter.ts`
- `src/infra/http/modules/Order/order.module.ts`
- `src/infra/http/pipes/zod-validation.pipe.ts`
- `src/infra/http/filters/use-case-error.filter.ts`
- `src/infra/http/filters/global-http-exception.filter.ts`

## Em aberto

- [ ] Escrita na tabela de outbox (tabela `outbox_events` ainda não
      existe) na mesma transação de `create`.
- [ ] Handler/publisher do `OrderPlacedEvent` no RabbitMQ.
- [ ] `make-order.schema.ts`/`cancel-order.schema.ts`/
      `delete-order.schema.ts` duplicam o mesmo response schema — decisão
      deliberada por ora (ver `prds/cancel-order.md`), extrair um schema
      compartilhado quando mais endpoints de `Order` existirem.
