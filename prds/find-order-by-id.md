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
- [ ] Endpoint HTTP (`GET /orders/:id`) — ainda não implementado.

## Requisitos funcionais

- [x] Recebe `id: string`.
- [x] Retorna `Either<OrderError, { order: Order }>`.
- [x] Retorna o `Order` completo quando encontrado, independentemente do
      `status` ou de `deletedAt`.

## Regras de validação / erros

- [x] `id` vazio (string vazia) → `OrderError('Order ID is required')`.
- [x] `id` com formato inválido (não é cuid2) → `OrderError('Invalid ID')`.
- [x] Pedido não encontrado no repositório → `OrderError('Order not
      found')`.
- [x] Pedido soft-deletado **não** é tratado como erro — é retornado
      normalmente, com `order.isDeleted === true`.

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

## Em aberto

- [ ] Endpoint HTTP `GET /orders/:id` — ainda não há controller/service
      para este use case (diferente de `create-order`, `cancel-order` e
      `soft-delete-order`, que já têm camada HTTP completa).
- [x] ~~Decidir, na camada que consome este use case, o que fazer com um
      pedido soft-deletado~~ — resolvido: ele é devolvido normalmente, com
      `isDeleted: true`, tanto no use case quanto na implementação real do
      repositório.
