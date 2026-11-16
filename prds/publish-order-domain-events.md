# PRD — Publicar eventos de domínio da Order via Queue

## Contexto / regra de negócio

`MakeOrderUseCase`/`CancelOrderUseCase` já constroem `OrderPlacedEvent`/
`OrderCancelledEvent` (`Order.place()`/`Order.cancel()`) e os expõem via
`order.domainEvents`. O port `Queue` (`eventName`/`toPayload()` em
`DomainEvent`, `publish`/`consume` em `Queue`) já existe. O que falta é o
elo entre os dois: o use case efetivamente chamar `Queue.publish()` com o
que o evento carrega.

Escopo deste PRD: **somente a camada de domínio/aplicação** (os dois use
cases, mais um helper compartilhado). Nenhuma mudança em infra — nem
`outbox_events`, nem `RabbitMqQueueGateway`, nem wiring de DI no
`order.module.ts`. Essas ficam para PRDs/trabalho separado (ver "Em
aberto").

## Decisão: publicação direta, sem outbox (aceita como gap conhecido)

Não existe hoje transação atômica entre persistir o agregado e publicar o
evento — a tabela `outbox_events` ainda não existe (ver
`prds/create-order.md`). Decisão: implementar a publicação direta mesmo
assim, avançando a mensageria sem bloquear no trabalho de infra pendente.
Isso reabre deliberadamente o problema clássico que o Outbox resolve: se o
processo cair entre `repository.create()/update()` resolver e
`queue.publish()` ser chamado, o evento se perde silenciosamente. Esse
risco é aceito nesta iteração e deve ser fechado quando a Outbox existir
(trocar a chamada direta por: grava na outbox na mesma transação → worker
separado lê a outbox e publica).

## Armadilha de ordenação: `domainEvents` é limpo pelo repositório

Achado crítico ao desenhar isto: `InMemoryOrdersRepository.create`/`update`
(e a futura implementação Drizzle, por contrato do port) já chamam
`DomainEvents.dispatchEventsForAggregate(order.id)` **dentro** de
`create`/`update` — o que despacha o evento para o mecanismo síncrono
in-process existente (`DomainEvents`, não relacionado à Queue) **e limpa**
`order.domainEvents` (`aggregate.clearEvents()`) como efeito colateral.

Isso significa: se o use case ler `order.domainEvents` **depois** de
`await this.ordersRepository.create(order)` resolver, o array já estará
vazio — não há evento nenhum para publicar na Queue.

**Decisão**: o use case deve capturar (`[...order.domainEvents]`) os
eventos pendentes **antes** de chamar `repository.create()/update()`, e só
publicá-los na Queue depois que essa chamada resolver sem lançar exceção
(ordem: capturar → persistir → publicar). Isso garante "só publica o que
foi de fato persistido" sem depender de timing do mecanismo `DomainEvents`
existente, que é ortogonal a este fluxo.

## Escopo

- [ ] `MakeOrderUseCase` publica `OrderPlacedEvent` após `create()` resolver.
- [ ] `CancelOrderUseCase` publica `OrderCancelledEvent` após `update()`
      resolver.
- [ ] Helper compartilhado `publishDomainEvents` (ver "Arquivos
      envolvidos") para não duplicar a lógica de captura/publish/erro nos
      dois use cases.
- [ ] `DeleteOrderUseCase` **fora de escopo**: `Order.delete()` não dispara
      nenhum domain event hoje (confirmado em `order.ts`) — nada a publicar.
- [ ] `FindOrderByIdUseCase`/`FindManyOrdersUseCase` **fora de escopo**:
      somente leitura, não produzem eventos.
- [ ] Nenhuma mudança em infra (outbox, RabbitMQ, DI do Nest) — ver "Em
      aberto".

## Requisitos funcionais

### `publishDomainEvents` (helper compartilhado)

- [x] Assinatura: `publishDomainEvents(queue: Queue, logger: Logger, exchange: string, events: readonly DomainEvent[]): Promise<void>`.
      `exchange` é parâmetro explícito (não fixo) — cada bounded context
      decide o seu (`ORDERS_EXCHANGE`, por ora o único que existe).
- [x] Para cada evento: chama `queue.publish(exchange, { messageId,
      routingKey: event.eventName, payload: event.toPayload() })`.
- [x] `messageId` gerado por chamada (`new ID().toValue()`) — não existe
      ainda uma linha de outbox cujo id reaproveitar (ver decisão acima);
      identifica esta publicação para o consumidor deduplicar contra
      *redelivery* do broker, não contra múltiplas publicações.
- [x] Publica os eventos **sequencialmente, na ordem em que aparecem** em
      `events` — nunca em paralelo (`Promise.all`): preserva a ordem causal
      em que o agregado os disparou.
- [x] Falha de publish (`QueueError`) é capturada por evento: registra via
      `logger.error(...)` (port `Logger`, ver seção abaixo) e segue para o
      próximo evento — nunca propaga, nunca aborta o loop.

### `MakeOrderUseCase`

- [x] Construtor ganha dois novos parâmetros: `queue: Queue`, `logger: Logger`.
- [x] Em `persistOrder`: captura `order.domainEvents` **antes** de chamar
      `this.ordersRepository.create(order)`.
- [x] Depois que `create()` resolver sem lançar, chama
      `publishDomainEvents(this.queue, this.logger, ORDERS_EXCHANGE, pendingEvents)`.
- [x] Remove os dois comentários `TODO` em `persistOrder` que descreviam
      este trabalho — ficam obsoletos após esta implementação (o segundo
      `TODO`, sobre registrar handler de `OrderPlacedEvent` no
      `DomainEvents`, continua obsoleto: a Queue substitui esse caminho
      para este propósito).

### `CancelOrderUseCase`

- [x] Construtor ganha dois novos parâmetros: `queue: Queue`, `logger: Logger`.
- [x] Mesmo padrão: captura `order.domainEvents` antes de
      `this.orderRepository.update(order)`, publica depois que resolver.

## Falha ao publicar — decisão fechada: port `Logger`

Se `queue.publish()` lançar (`QueueError`) depois que o pedido já foi
persistido com sucesso, o pedido **já existe** de verdade — não faz
sentido reportar a requisição inteira como falha nem reverter a
persistência (o rollback é impossível aqui: não há transação cobrindo as
duas operações, por desenho, ver seção acima).

Entre as duas opções avaliadas (callback `onPublishFailure` por chamada
vs. um port `Logger` dedicado), a decisão foi pelo **port `Logger`**
(mesmo padrão arquitetural de `Queue`/`OrdersRepository`):

- [x] Novo port `src/domain/application/shared/gateways/logger.ts`:
      `abstract class Logger { abstract error(message: string, meta?:
      Record<string, unknown>): void; }`. Mínimo de propósito (YAGNI) —
      só `error`, sem `info`/`warn`/`debug` enquanto nada os usa.
- [x] Double de teste `test/gateways/fake-logger.ts` (`FakeLogger`),
      seguindo o mesmo padrão de `FakeQueue` (array público + `reset()`).
- [x] O use case **não propaga** `QueueError` como resultado da
      `execute()` — continua retornando `right({ order })` normalmente.
      A falha de publish é um problema de entrega assíncrona, não de
      criação/cancelamento do pedido.
- [x] `publishDomainEvents` recebe `logger: Logger` como segundo
      parâmetro, captura `QueueError` internamente por evento e chama
      `logger.error(...)` com contexto estruturado (`eventName`,
      `exchange`, `aggregateId`, `cause`), seguindo para o próximo evento
      (nunca aborta o loop, nunca propaga).
- [x] A implementação concreta de `Logger` (Pino, o `Logger` do Nest,
      etc.) fica para a infra — fora de escopo deste PRD.

## Impacto em testes existentes

- [x] `make-order-use-case.spec.ts` e `cancel-order-use-case.spec.ts`
      passam `FakeQueue` + `FakeLogger` ao construir o `sut` — o
      construtor deixa de aceitar só `ordersRepository`.
- [x] Novos casos de teste (ambos specs):
  - [x] publica no exchange/routing key corretos (`ORDERS_EXCHANGE`/
        `ORDER_ROUTING_KEYS.PLACED` ou `.CANCELLED`) — inspecionando
        `fakeQueue.publishedMessages`.
  - [x] payload publicado bate com `event.toPayload()`.
  - [x] usando `fakeQueue.setPublishFailure()`: a `execute()` ainda
        retorna `right({ order })`, e `fakeLogger.errors` registra a
        falha (ver seção "Falha ao publicar" acima).
  - [x] eventos pendentes são capturados antes do `clearEvents()`
        disparado pelo repositório — teste de regressão direto para a
        armadilha de ordenação descrita acima (ex.: espionar
        `fakeQueue.publishedMessages` não fica vazio mesmo com
        `InMemoryOrdersRepository` limpando `order.domainEvents`).

## Arquivos envolvidos

### Domínio (criado/alterado)

- `src/domain/application/shared/gateways/logger.ts` (novo)
- `src/domain/application/shared/events/publish-domain-events.ts` (novo)
- `src/domain/application/Order/use-cases/make-order-use-case.ts`
- `src/domain/application/Order/use-cases/cancel-order-use-case.ts`

### Testes (criados/alterados)

- `test/gateways/fake-logger.ts` + `.spec.ts` (novo)
- `src/domain/application/shared/events/publish-domain-events.spec.ts` (novo)
- `src/domain/application/Order/use-cases/make-order-use-case.spec.ts`
- `src/domain/application/Order/use-cases/cancel-order-use-case.spec.ts`

### Já prontos, sem alteração (pré-requisitos já implementados)

- `src/domain/application/shared/gateways/queue.ts`
- `src/domain/application/shared/errors/queue.error.ts`
- `src/core/consts/messaging.consts.ts`
- `test/gateways/fake-queue.ts` + `.spec.ts`
- `test/factories/make-queue-message.ts`

## Em aberto (fora deste PRD)

- [ ] Infra: `order.module.ts` precisa prover implementações de `Queue` e
      `Logger` via DI (nem que sejam stubs) para `MakeOrderService`/
      `CancelOrderService` compilarem como providers do Nest — hoje eles
      só repassam `ordersRepository` ao `super()`.
- [ ] Infra real: `RabbitMqQueueGateway` (implementação concreta de
      `Queue` com `@golevelup/nestjs-rabbitmq`, ver README seção 8.2).
- [ ] Tabela `outbox_events` + transação atômica no
      `DrizzleOrdersRepository` — quando existir, substitui a publicação
      direta implementada aqui por: gravar na outbox na mesma transação,
      e um worker separado lendo a outbox é quem passa a chamar
      `Queue.publish()` (este PRD deixa de ser o ponto de publish).
- [ ] `DeleteOrderUseCase`/rotina de purge: caso algum dia `Order.delete()`
      passe a emitir um domain event, reavaliar se este use case entra no
      mesmo padrão.

## Status

Implementado na camada de domínio/aplicação (ver checkboxes acima).
Falta apenas o wiring de infra listado em "Em aberto".
