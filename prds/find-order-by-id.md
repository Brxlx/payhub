# PRD — Buscar Pedido por ID (Find Order by ID)

## Contexto / regra de negócio

Buscar um pedido por id é uma operação de leitura pura — não existe
nenhuma regra de domínio que impeça encontrar um pedido em qualquer estado,
incluindo um pedido que já passou por soft delete (`deletedAt` preenchido).
Quem decide o que fazer com um pedido deletado (esconder, avisar, bloquear
uma ação) é a camada consumidora, não este use case.

## Escopo

- [x] Buscar um `Order` pelo seu `id`.
- [x] Encontrar pedidos soft-deletados normalmente (não é tratado como
      "não encontrado") — decisão confirmada e corrigida na implementação
      real (ver seção abaixo).
- [x] Endpoint HTTP (`GET /orders/:id`).

## Requisitos funcionais

- [x] Recebe `id: string`.
- [x] Retorna `Either<OrderError | OrderNotFoundError, { order: Order }>`.
- [x] Retorna o `Order` completo quando encontrado, independentemente do
      `status` ou de `deletedAt`.

### Camada HTTP

- [x] `GET /orders/:id`, `200 OK`.
- [x] Validação do path param `id` via Zod (`findOrderByIdParamsSchema`,
      mesmo padrão de `ID.isValid()` dos outros fluxos).
- [x] Resposta serializada via `OrderPresenter.toHTTP` (mesmo shape
      reaproveitado de `create-order`/`cancel-order`/`soft-delete-order`).
- [x] `OrderNotFoundError` → `404`; `OrderError` (formato inválido de
      `id`) → `400` (`use-case-error.filter.ts`).

## Regras de validação / erros

- [x] `id` vazio (string vazia) → `OrderError('Order ID is required')`
      (`400`).
- [x] `id` com formato inválido (não é cuid2) → `OrderError('Invalid ID')`
      (`400`).
- [x] `id` válido mas sem pedido correspondente → `OrderNotFoundError`
      (`404`) — ver correção de inconsistência abaixo.
- [x] Pedido soft-deletado **não** é tratado como erro — é retornado
      normalmente, com `order.isDeleted === true`.

## Inconsistência de erro corrigida: `OrderError` genérico vs `OrderNotFoundError`

Antes de implementar a camada HTTP, o use case usava `OrderError`
genérico também para "pedido não encontrado" (`left(new
OrderError('Order not found'))`). Como `OrderError.name` mapeia para
`400 Bad Request`, um `GET /orders/:id` com um `id` válido mas inexistente
retornaria `400` em vez do `404` esperado — diferente de `cancel-order` e
`soft-delete-order`, que já usavam `OrderNotFoundError` para esse mesmo
caso.

Corrigido trocando para `left(new OrderNotFoundError(id))`. O teste que já
existia com o nome `'should return an error when order is not found'`
continua passando sem mudanças — ele na verdade testa um `id` com formato
inválido (`'non-existent-id'` não é cuid2), então cai em `OrderError`
mesmo. Foi adicionado um teste novo
(`'should return an error when a valid id has no matching order'`) que
exercita o caso real (id válido, sem registro) esperando
`OrderNotFoundError`.

- [x] `find-order-by-id-use.case.ts` usa `OrderNotFoundError` para
      "não encontrado".
- [x] `OrderError` reservado para erros de formato (`id` vazio/inválido).
- [x] Teste novo cobrindo id válido sem registro correspondente.

## Bug encontrado e corrigido na implementação real (Drizzle)

Este PRD já documentava a decisão "busca por id encontra pedido mesmo
deletado" e o spec correspondente
(`'should find an order that has been soft-deleted'`) já cobria isso contra
o `InMemoryOrdersRepository`. Mas `DrizzleOrdersRepository.findById` — a
implementação real usada em produção — tinha sido escrita filtrando
`isNull(orders.deletedAt)`, divergindo desse contrato sem que nenhum teste
pegasse (o spec deste use case só roda contra o repositório em memória).

O bug só ficou visível testando manualmente outro fluxo
(`DELETE /orders/:id` numa order já deletada devolvendo `404` em vez de
`409` — ver `prds/soft-delete-order.md` para a investigação completa).
Corrigido removendo o filtro de `findById` no Drizzle, alinhando com o que
este PRD e os testes já assumiam.

- [x] `DrizzleOrdersRepository.findById` não filtra mais `deletedAt`.
- [x] `DrizzleOrdersRepository.findManyWithFilters` continua filtrando
      `deletedAt` — listagens escondem pedidos deletados, busca direta por
      id não (ver decisão completa em `prds/soft-delete-order.md`).

## Arquivos envolvidos

- `src/domain/application/Order/use-cases/find-order-by-id-use.case.ts`
- `src/domain/application/Order/use-cases/find-order-by-id-use.case.spec.ts`
- `src/domain/enterprise/entities/order.ts` (`isDeleted`, `deletedAt`)
- `src/domain/application/Order/repositories/orders.repository.ts`
  (`OrdersRepository.findById`)
- `src/infra/database/drizzle/repositories/drizzle-orders.repository.ts`
  (`findById` — implementação real, fix do filtro de `deletedAt`)

### Infra (HTTP)

- `src/infra/http/modules/Order/find-order-by-id.controller.ts`
- `src/infra/http/modules/Order/find-order-by-id.service.ts`
- `src/infra/http/modules/Order/types/find-order-by-id.schema.ts`
- `src/infra/http/modules/Order/types/order.dto.ts`
- `src/infra/http/modules/Order/presenters/order.presenter.ts`
  (reaproveitado)
- `src/infra/http/modules/Order/order.module.ts`
- `src/infra/http/filters/use-case-error.filter.ts`

## Em aberto

- [x] ~~Endpoint HTTP `GET /orders/:id`~~ — implementado.
- [x] ~~Decidir, na camada que consome este use case, o que fazer com um
      pedido soft-deletado~~ — resolvido: ele é devolvido normalmente, com
      `isDeleted: true`, tanto no use case quanto na implementação real do
      repositório.
- [ ] `findOrderByIdResponseSchema` duplica o mesmo shape de
      `makeOrderResponseSchema`/`cancelOrderResponseSchema`/
      `deleteOrderResponseSchema` — decisão deliberada por ora, extrair
      quando mais endpoints existirem.
