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
- [ ] Filtro por valor (ex.: `status=PLACED`, `customerId=...`) — **não
      implementado**. Ver nota sobre `OrderFilters` abaixo.
- [ ] Endpoint HTTP (`GET /orders`).

## Requisitos funcionais

- [x] Recebe `page?: number`, `itemsPerPage?: number` (via
      `PaginationParams`).
- [x] Aplica defaults quando omitidos: `page=1`, `itemsPerPage=20`
      (`PaginationParamsConsts`, em `core/consts/pagination.consts.ts`).
- [x] Valida limites: `page` inteiro ≥ 1; `itemsPerPage` inteiro entre 1 e
      100 (`PaginationParamsConsts.MAX_ITEMS_PER_PAGE`).
- [x] Retorna `{ orders, total, page, itemsPerPage, hasMore }`.
- [x] Página além do total de registros não é erro — retorna lista vazia
      com `hasMore: false`.

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

## Em aberto

- [ ] Endpoint HTTP `GET /orders` (com `page`/`itemsPerPage` via query
      string, validados por Zod — README seção 7).
- [ ] Implementação real via Drizzle de
      `OrdersRepository.findManyWithFilters` (hoje só
      `InMemoryOrdersRepository`).
- [ ] Read model `OrderSummary` + CQRS, para reaproveitar `OrderFilters` de
      verdade (ver seção acima e README seção 15).
- [ ] Migração de paginação offset → cursor quando `orders` passar de
      ~500k linhas (já listado no README, seção 15).
