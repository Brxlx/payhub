# PRD — Criar Pedido (Create Order)

## Contexto / regra de negócio

PayHub não se comporta como carrinho de compras: um pedido não tem um estado
intermediário de "rascunho salvo" exposto pela API. O pedido chega completo
em uma única chamada e é criado e confirmado (`place()`) juntos, na mesma
operação.

## Escopo

- [x] Criar um `Order` a partir de `customerId` e uma lista de itens.
- [x] Confirmar o pedido (`DRAFT` → `PLACED`) como parte da mesma operação.
- [ ] Persistência real (Drizzle), incluindo `orders` + `order_items` na
      mesma transação (ver README seção 6.3).
- [ ] Gravar o evento `OrderPlacedEvent` na tabela de outbox, na mesma
      transação (ver README seção 8.3 — Transactional Outbox). Hoje é só um
      `TODO` em `MakeOrderUseCase.persistOrder`.
- [ ] Publicar `OrderPlacedEvent` no RabbitMQ (exchange `orders.events`,
      routing key `order.placed`) — depende do módulo de mensageria, que
      ainda não existe (README seção 8).
- [ ] Endpoint HTTP (`POST /orders`, conforme README seção 14).

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

- `src/domain/application/Order/use-cases/make-order-use-case.ts`
- `src/domain/application/Order/use-cases/make-order-use-case.spec.ts`
- `src/domain/enterprise/entities/order.ts` (`Order.create`, `Order.place`)
- `src/domain/enterprise/entities/order-item.ts` (`OrderItem.create`,
  `assertValidProductId`, `assertValidQuantity`)
- `src/domain/enterprise/entities/value-objects/money.vo.ts`
  (`Money.fromCents`)
- `src/domain/application/Order/repositories/orders.repository.ts`
  (`OrdersRepository.create`)

## Em aberto

- [ ] Persistência real via Drizzle (hoje só há `InMemoryOrdersRepository`
      em `test/repositories`, usado nos testes).
- [ ] Escrita na tabela de outbox na mesma transação de `create`.
- [ ] Handler/publisher do `OrderPlacedEvent` no RabbitMQ.
- [ ] Endpoint HTTP `POST /orders` com validação Zod (README seção 7).
