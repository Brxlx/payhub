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
      "não encontrado").
- [ ] Endpoint HTTP (`GET /orders/:id`).

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

## Arquivos envolvidos

- `src/domain/application/Order/use-cases/find-order-by-id-use.case.ts`
- `src/domain/application/Order/use-cases/find-order-by-id-use.case.spec.ts`
- `src/domain/enterprise/entities/order.ts` (`isDeleted`, `deletedAt`)
- `src/domain/application/Order/repositories/orders.repository.ts`
  (`OrdersRepository.findById`)

## Em aberto

- [ ] Endpoint HTTP `GET /orders/:id`.
- [ ] Decidir, na camada que consome este use case (ex.: controller HTTP),
      o que fazer com um pedido soft-deletado — hoje ele é devolvido
      normalmente, cabe ao chamador decidir se esconde/avisa/bloqueia.
