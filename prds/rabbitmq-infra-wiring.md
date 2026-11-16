# PRD — Wiring de infra: RabbitMQ real + Logger + DI no `OrderModule`

## Contexto

`prds/publish-order-domain-events.md` já implementou a camada de
domínio/aplicação: `Queue`/`Logger` (ports), `MakeOrderUseCase`/
`CancelOrderUseCase` publicando via `publishDomainEvents`, tudo coberto
por `FakeQueue`/`FakeLogger` nos testes. O que falta — e é o escopo
**deste** PRD — é a implementação concreta dos dois ports e o wiring de
DI que faz `MakeOrderService`/`CancelOrderService` (que hoje só repassam
`ordersRepository` ao `super()`, ver `order.module.ts`) compilarem como
providers do Nest.

Decisão confirmada com o usuário: este PRD cobre RabbitMQ **real** (não
um stub) — adiciona `@golevelup/nestjs-rabbitmq` (já apontado no README,
seção 2 e 8.2), declara a exchange `orders.events` (topic, README seção
8.1) e conecta de fato via variável de ambiente. `docker-compose.yml` já
tem um serviço `rabbitmq:4-management` pronto; falta só a aplicação se
conectar a ele.

## Fora de escopo (explicitamente)

- **Nenhum consumer.** Nenhuma fila (`notifications.order-placed`,
  `analytics.order-placed`, `notifications.order-cancelled`, ver README
  seção 8.1) é criada aqui — não existe ainda nenhum bounded context que
  consuma essas mensagens no projeto. `Queue.consume` é implementado (o
  port exige), mas nada no app o chama ainda.
- **Dead-letter exchange (`orders.events.dlx`).** Faz sentido quando a
  primeira fila/consumer existir — hoje não há fila nenhuma para ter uma
  DLQ. Declarar a DLX agora seria topologia morta. Fica para o PRD do
  primeiro consumer.
- **`outbox_events` / transação atômica.** Gap já aceito e documentado em
  `prds/publish-order-domain-events.md` — publicação continua direta.
- **Testes de integração reais (Testcontainers + RabbitMQ).** O projeto
  não tem Testcontainers configurado ainda (não está em
  `package.json`). Este PRD cobre só testes unitários dos adapters
  (mockando `AmqpConnection`). Ver "Em aberto".

## Decisões técnicas

### 1. Nova dependência: `@golevelup/nestjs-rabbitmq`

```
pnpm add @golevelup/nestjs-rabbitmq amqp-connection-manager amqplib
pnpm add -D @types/amqplib
```

(`amqp-connection-manager`/`amqplib` são peer deps da lib — ela não os
reexporta.)

### 2. Variável de ambiente: `RABBITMQ_URL`

`.env.production.example` já tem `RABBITMQ_USER`/`RABBITMQ_PASSWORD`
soltos (usados só pelo `docker-compose.yml` para configurar a imagem do
RabbitMQ), mas `envSchema` não tem nada de RabbitMQ. Em vez de a
aplicação remontar a URI a partir de host/user/senha separados, seguimos
o mesmo padrão já usado para `DATABASE_URL`: uma única variável de
conexão.

- [ ] `envSchema` (`src/infra/shared/env/env.schema.ts`) ganha:
      `RABBITMQ_URL: z.url().startsWith('amqp://')`.
- [ ] `.env.example`: `RABBITMQ_URL=amqp://guest:guest@localhost:5672`
      (combina com o `rabbitmq:4-management` do `docker-compose.yml`
      rodando localmente com usuário/senha default).
- [ ] `.env.production.example`: `RABBITMQ_URL=amqp://admin:TROQUE_ESTA_SENHA@rabbitmq:5672`
      (nome do serviço do compose, mesma rede) — e `RABBITMQ_USER`/
      `RABBITMQ_PASSWORD` continuam existindo ali (usados só pela
      imagem oficial do RabbitMQ no compose, não pela app).

### 3. `RabbitMqQueueGateway` — implementação de `Queue`

Novo módulo de infra: `src/infra/messaging/`.

- [ ] `src/infra/messaging/messaging.module.ts`: `RabbitMQModule.forRootAsync`
      (do `@golevelup/nestjs-rabbitmq`), injetando `EnvService` para
      `uri: envService.get('RABBITMQ_URL')`, declarando só a exchange
      `ORDERS_EXCHANGE` (`orders.events`, tipo `topic`) em `exchanges`.
      Nenhuma fila declarada aqui (ver "Fora de escopo").
- [ ] `src/infra/messaging/rabbitmq-queue.gateway.ts`: `RabbitMqQueueGateway
      implements Queue`, injeta `AmqpConnection` (de
      `@golevelup/nestjs-rabbitmq`).
  - [ ] `publish(exchange, message)`: chama
        `amqpConnection.publish(exchange, message.routingKey,
        message.payload, { messageId: message.messageId })` — usa o
        campo nativo de propriedades AMQP `messageId` em vez de embutir
        no payload, para o broker/consumidores conseguirem inspecionar
        sem parsear o body. Qualquer erro do client (`amqplib`/
        `amqp-connection-manager`) é capturado e relançado como
        `QueueError` (`QueueErrorMessagesConsts.SEND_TO_QUEUE_ERROR`) —
        nunca deixa o erro cru do AMQP vazar para o domínio (ver
        `queue.ts`, JSDoc de `publish`).
  - [ ] `consume(queueName, handler)`: usa `amqpConnection.createSubscriber`
        (API pública da lib para registrar subscriptions dinamicamente,
        em runtime — o mesmo mecanismo que o decorator `@RabbitSubscribe`
        usa por baixo) para registrar `handler` na fila `queueName`.
        Converte a mensagem AMQP recebida para `QueueMessage` (routing
        key da própria entrega, payload já desserializado pela lib,
        `messageId` da propriedade AMQP) antes de chamar `handler`. Sem
        nenhum consumer real no projeto ainda, este caminho fica sem
        cobertura de teste de integração — só o shape é implementado
        para satisfazer o port.
- [ ] `src/infra/messaging/messaging.module.ts` fornece o binding:
      `{ provide: Queue, useClass: RabbitMqQueueGateway }`, exportado.

### 4. `NestLoggerAdapter` — implementação de `Logger`

- [ ] `src/infra/logging/nest-logger.adapter.ts` (nova pasta
      `src/infra/logging/`): `NestLoggerAdapter implements Logger`,
      usando `prefixedLogger` (já existe em
      `@/infra/helpers/prefixed-logger`, mesmo helper usado por
      `DrizzleService`/`App`) para manter o mesmo formato de log do
      resto da infra.
  - [ ] `error(message, meta)`: `meta`, quando presente, é serializado
        (`JSON.stringify`) e anexado à mensagem — a API do `Logger` do
        Nest (`error(message, trace?, context?)`) não tem um parâmetro
        estruturado para metadata arbitrária.
- [ ] Registrado como provider em `MessagingModule` (mesmo módulo do
      `Queue` — os dois existem para o mesmo motivo: observar falhas de
      publish) via `{ provide: LoggerPort, useClass: NestLoggerAdapter }`
      (`LoggerPort` = alias de import para `@/domain/application/shared/gateways/logger`,
      evitando colidir com o `Logger` do `@nestjs/common` usado
      internamente pelo próprio adapter).

### 5. DI no `OrderModule`

- [ ] `order.module.ts` importa `MessagingModule`.
- [ ] `MakeOrderService`/`CancelOrderService`
      (`src/infra/http/modules/Order/*.service.ts`) ganham `queue: Queue`
      e `logger: Logger` no construtor, repassados ao `super(...)` —
      hoje só repassam `ordersRepository`.

## Escopo (checklist)

- [ ] Dependências instaladas (`@golevelup/nestjs-rabbitmq` +
      `amqp-connection-manager` + `amqplib` + `@types/amqplib`).
- [ ] `RABBITMQ_URL` em `envSchema`, `.env.example`,
      `.env.production.example`.
- [ ] `MessagingModule` (`forRootAsync` com a exchange `orders.events`,
      bindings de `Queue` e `Logger`).
- [ ] `RabbitMqQueueGateway` (`publish` real + `consume` via
      `createSubscriber`), com testes unitários mockando
      `AmqpConnection`.
- [ ] `NestLoggerAdapter`, com teste unitário verificando a formatação
      da mensagem/meta.
- [ ] `order.module.ts` + `*.service.ts` atualizados para injetar
      `Queue`/`Logger` de verdade.
- [ ] `README.md`: nenhuma mudança de conteúdo necessária (seção 8 já
      descreve exatamente esta topologia) — só confirmar que o exemplo
      de publisher (8.2) continua compatível com o gateway implementado.

## Requisitos funcionais

### `RabbitMqQueueGateway.publish`

- [ ] Publica no exchange/routingKey recebidos como parâmetros — nunca
      hardcoded no gateway (mesma razão do port: múltiplos bounded
      contexts podem reusar o mesmo `Queue`).
- [ ] Propriedades AMQP da mensagem incluem `messageId` (vindo de
      `QueueMessage.messageId`) e `persistent: true` (mensagem
      sobrevive a restart do broker — obrigatório para não perder
      eventos de negócio).
- [ ] Qualquer exceção do client AMQP vira `QueueError`, preservando a
      causa original (`cause` ou mensagem concatenada) para debug.

### `RabbitMqQueueGateway.consume`

- [ ] Registra `handler` para `queueName` via `createSubscriber`.
- [ ] Erros lançados pelo `handler` (ex.: `handler` rejeita a promise)
      não devem ser engolidos pela lib — devem resultar em `nack`
      (redelivery), comportamento já default do `createSubscriber` da
      lib quando o handler lança; não precisa de código extra aqui.
- [ ] **Sem fila real registrada neste PRD** — o método existe, mas
      nenhum caller o invoca ainda (ver "Fora de escopo").

### `NestLoggerAdapter.error`

- [ ] `error('mensagem')` sem `meta`: loga só a mensagem.
- [ ] `error('mensagem', { foo: 'bar' })`: loga mensagem + meta
      serializado, de forma legível (não um blob JSON ilegível em uma
      linha só — avaliar formatação durante a implementação).

### `MessagingModule`

- [ ] `RabbitMQModule.forRootAsync` injeta `EnvService`, usa
      `RABBITMQ_URL`.
- [ ] Declara a exchange `ORDERS_EXCHANGE` (de
      `@/core/consts/messaging.consts`), tipo `topic`.
- [ ] Exporta os bindings de `Queue` e `Logger` para `OrderModule`
      importar.

## Impacto em testes existentes

- [ ] Nenhum teste de `FakeQueue`/`FakeLogger`/`publishDomainEvents`/
      `MakeOrderUseCase`/`CancelOrderUseCase` muda — todos continuam
      testando o port (`Queue`/`Logger`), não a implementação concreta.
      Isso é o ponto de ter ports: trocar o adapter não deveria quebrar
      nenhum teste de domínio.

## Novos testes

- [ ] `rabbitmq-queue.gateway.spec.ts`: mocka `AmqpConnection.publish`
      (vi.fn), verifica que `publish` chama com exchange/routingKey/
      payload corretos e que uma rejeição do mock vira `QueueError`.
- [ ] `nest-logger.adapter.spec.ts`: espiona o `Logger` do Nest
      (`vi.spyOn`) e verifica o formato da chamada com/sem `meta`.

## Arquivos envolvidos

### Infra (a criar)

- `src/infra/messaging/messaging.module.ts`
- `src/infra/messaging/rabbitmq-queue.gateway.ts`
- `src/infra/messaging/rabbitmq-queue.gateway.spec.ts`
- `src/infra/logging/nest-logger.adapter.ts`
- `src/infra/logging/nest-logger.adapter.spec.ts`

### Infra (a alterar)

- `src/infra/shared/env/env.schema.ts` (+ `RABBITMQ_URL`)
- `src/infra/http/modules/Order/order.module.ts` (importa `MessagingModule`)
- `src/infra/http/modules/Order/make-order.service.ts`
- `src/infra/http/modules/Order/cancel-order.service.ts`
- `.env.example`, `.env.production.example`
- `package.json` (novas dependências)

### Já prontos, sem alteração (pré-requisitos já implementados)

- `src/domain/application/shared/gateways/queue.ts`
- `src/domain/application/shared/gateways/logger.ts`
- `src/domain/application/shared/errors/queue.error.ts`
- `src/domain/application/shared/events/publish-domain-events.ts`
- `src/core/consts/messaging.consts.ts`
- `docker-compose.yml` (serviço `rabbitmq` já existe)

## Em aberto (fora deste PRD)

- [ ] Primeiro consumer real (ex.: `notifications.order-placed`) — traz
      junto a decisão de DLX/DLQ (README seção 8.1) e idempotência do
      lado consumidor (`processed_messages` ou similar, README seção
      8.4).
- [ ] Testes de integração reais com RabbitMQ via Testcontainers (README
      seção 10) — hoje nenhum devDependency de Testcontainers existe no
      projeto; avaliar se vale a pena antes ou depois do primeiro
      consumer real (um teste de publish isolado, sem nenhum consumer
      para validar a entrega, tem valor limitado).
- [ ] `outbox_events` + transação atômica (ver
      `prds/publish-order-domain-events.md`) — quando existir, o
      `RabbitMqQueueGateway` implementado aqui passa a ser chamado por
      um worker de outbox, não diretamente pelos use cases.
- [ ] Health check do RabbitMQ (`@nestjs/terminus`, README seção 12) —
      fora de escopo de mensageria em si.
