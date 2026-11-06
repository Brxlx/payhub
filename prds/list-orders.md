# PRD — Listar Pedidos (List Orders / Find Many)

## Contexto / regra de negócio

Listagem paginada de pedidos. Segue o contrato de paginação do README
(seção 9.1), adaptado para `page`/`itemsPerPage` (em vez de `take`/`skip`,
que é só o exemplo ilustrativo do README).

A divisão de responsabilidade é deliberada:

- O **use case** decide a *política* de paginação: defaults e limites de
  `page`/`itemsPerPage`.
- O **repositório** (quem executa a query) decide a *mecânica*: fatiar os
  dados e calcular `hasMore`/`total`. O use case nunca recalcula o que o
  repositório já calculou.

## Escopo

- [x] Listar pedidos com paginação por `page`/`itemsPerPage`.
- [x] Devolver `total` e `hasMore`.
- [x] Implementação real via Drizzle de
      `OrdersRepository.findManyWithFilters` (antes só havia
      `InMemoryOrdersRepository`).
- [x] Endpoint HTTP (`GET /orders`).
- [ ] Filtro por valor (ex.: `status=PLACED`, `customerId=...`) — **não
      implementado**. Ver nota sobre `OrderFilters` abaixo.

## Requisitos funcionais

- [x] Recebe `page?: number`, `itemsPerPage?: number` (via
      `PaginationParams`).
- [x] Aplica defaults quando omitidos: `page=1`, `itemsPerPage=20`
      (`PaginationParamsConsts`, em `core/consts/pagination.consts.ts`).
- [x] Valida limites: `page` inteiro ≥ 1; `itemsPerPage` inteiro entre 1 e
      100 (`PaginationParamsConsts.MAX_ITEMS_PER_PAGE`).
- [x] Retorna `{ orders, total, page, itemsPerPage, hasMore }`.
- [x] Página além do total de registros não é erro — retorna lista vazia
      com `hasMore: false` (ver nota sobre custo abaixo).

### Camada HTTP

- [x] `GET /orders`, `200 OK`, `page`/`itemsPerPage` via query string.
- [x] Validação via Zod (`findManyOrdersQuerySchema`) com
      `z.coerce.number()` (query string sempre chega como string) +
      `.int().positive()`; `itemsPerPage` limitado a
      `PaginationParamsConsts.MAX_ITEMS_PER_PAGE` também no schema HTTP,
      espelhando o limite já validado no use case.
- [x] Valida o objeto inteiro (não um campo isolado como em
      `cancel-order`/`soft-delete-order`/`find-order-by-id`), então o
      `issue.path` do erro já vem correto sem precisar do fallback de
      `metadata.data` em `zod-validation.pipe.ts`.
- [x] Resposta: `{ orders: OrderHTTPResponse[], total, page, itemsPerPage,
      hasMore }` — `orders` mapeado com `OrderPresenter.toHTTP` (único
      endpoint que devolve uma lista em vez de um `Order` único).
- [x] `OrderError` (paginação inválida) → `400`
      (`use-case-error.filter.ts`, já existente).

### Página fora do range não é erro, e não há como economizar a query

Testado manualmente: `page=5`/`itemsPerPage=1` com `total=4` registros
retorna `{ orders: [], total: 4, page: 5, itemsPerPage: 1, hasMore: false }`
com `200 OK` — comportamento esperado, não um bug. Confirmação da decisão
já documentada acima, com o raciocínio completo:

- Segue a convenção padrão de paginação REST (GitHub, Stripe etc.): uma
  página fora do range não é erro de input do cliente, é só um filtro que
  não bateu com nada — mesma lógica de um `GET` com filtro que retorna
  zero resultados. Tratar como erro exigiria o cliente checar `total`
  antes de cada request (e mesmo assim haveria corrida: alguém
  cria/cancela um pedido entre a checagem e a busca).
- Não há como evitar a ida ao banco: a query de `count()` é obrigatória de
  qualquer forma (é dela que vem `total`/`hasMore` na resposta), então não
  existe atalho real para "checar se a página é válida antes de buscar" —
  essa checagem exigiria o próprio `total`.
- Em tabelas grandes, o que realmente fica caro é `OFFSET` alto em si
  (não o fato da página estar fora do range) — já mapeado no roadmap como
  migração para paginação por cursor (ver último item de "Em aberto").

### Implementação real (Drizzle)

- [x] `DrizzleOrdersRepository.findManyWithFilters` busca a página de
      `orders` (`orderBy(desc(createdAt))`, `limit`/`offset`) e a contagem
      total (`count()`) em paralelo (`Promise.all`).
- [x] Busca os `order_items` de todos os pedidos da página numa única
      query (`inArray(orderItems.orderId, orderIds)`), agrupando em
      memória por `orderId` antes de montar cada agregado via
      `OrderMapper.toDomain` — evita N+1 queries.
- [x] Filtra `isNull(orders.deletedAt)`: pedidos soft-deletados não
      aparecem na listagem. Essa é a metade "esconde em listas" da decisão
      de visibilidade documentada em `prds/soft-delete-order.md` — a outra
      metade (`findById` encontra mesmo deletado) está em
      `prds/find-order-by-id.md`.
- [x] `hasMore` calculado como `offset + resultOrders.length < total`.

## Regras de validação / erros

- [x] `page` não é inteiro positivo → `OrderError`.
- [x] `itemsPerPage` ≤ 0 ou não-inteiro → `OrderError`.
- [x] `itemsPerPage` > 100 → `OrderError`.
- [x] `itemsPerPage` = 100 (limite superior) é aceito.

## Sobre `OrderFilters` (decisão de arquitetura)

`OrderFilters` (seletor de projeção de campos, ex.: `{ status: true }`) foi
**removido** da cadeia deste use case (e do `OrdersRepository`). Motivo:
este repositório devolve o agregado `Order` completo, e um agregado parcial
violaria suas próprias invariantes (ex.: `Order.total` depende de `items`
estar carregado). Projeção de campos só faz sentido num read model dedicado
(DTO plano, fora do agregado) — plano concreto já anotado no README, seção
15 (roadmap, item de CQRS): um `OrderSummary` + `OrderSummariesRepository` +
`ListOrderSummariesUseCase` paralelo a este.

- [ ] `OrderSummary` (DTO de leitura, fora do agregado).
- [ ] `OrderSummariesRepository` / `DrizzleOrderSummariesRepository`
      (projeção de colunas de verdade no `SELECT`, pulando o `JOIN` com
      `order_items` quando não necessário).
- [ ] `ListOrderSummariesUseCase`.

## Arquivos envolvidos

- `src/domain/application/Order/use-cases/find-many-orders-use-case.ts`
- `src/domain/application/Order/use-cases/find-many-orders-use-case.spec.ts`
- `src/domain/application/Order/repositories/orders.repository.ts`
  (`FindManyOrdersParams`, `FindManyOrdersResult`,
  `OrdersRepository.findManyWithFilters`)
- `src/core/repositories/paginations-params.ts` (`PaginationParams`)
- `src/core/consts/pagination.consts.ts` (`PaginationParamsConsts`)
- `src/core/repositories/order-filters.ts` (`OrderFilters` — hoje sem uso
  nesta cadeia; documentado como tal no próprio arquivo)
- `test/repositories/in-memory-orders-repository.ts`
  (`findManyWithFilters`, cálculo de `hasMore`)
- `src/infra/database/drizzle/repositories/drizzle-orders.repository.ts`
  (`findManyWithFilters` — implementação real)

### Infra (HTTP)

- `src/infra/http/modules/Order/find-many-orders.controller.ts`
- `src/infra/http/modules/Order/find-many-orders.service.ts`
- `src/infra/http/modules/Order/types/find-many-orders.schema.ts`
- `src/infra/http/modules/Order/types/order.dto.ts`
- `src/infra/http/modules/Order/presenters/order.presenter.ts`
  (reaproveitado — `orders.map(OrderPresenter.toHTTP)`)
- `src/infra/http/modules/Order/order.module.ts`

## Em aberto

- [x] ~~Endpoint HTTP `GET /orders`~~ — implementado.
- [ ] Read model `OrderSummary` + CQRS, para reaproveitar `OrderFilters` de
      verdade (ver seção acima e README seção 15).
- [ ] Migração de paginação offset → cursor quando `orders` passar de
      ~500k linhas (já listado no README, seção 15) — única solução real
      para o custo de `OFFSET` alto em tabelas grandes (ver nota acima).
