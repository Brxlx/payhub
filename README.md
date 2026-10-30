# 🏗️ Projeto Base — NestJS + DDD + Drizzle + RabbitMQ + Zod

> Arquitetura de referência para um backend corporativo, construído do zero com foco em **Domain-Driven Design tático**, tipagem forte ponta-a-ponta e infraestrutura assíncrona.

---

## 📑 Índice

1. [Visão geral e princípios](#1-visão-geral-e-princípios)
2. [Stack tecnológica](#2-stack-tecnológica)
3. [Arquitetura em camadas](#3-arquitetura-em-camadas)
4. [Estrutura de pastas](#4-estrutura-de-pastas)
5. [Modelagem de domínio (DDD tático)](#5-modelagem-de-domínio-ddd-tático)
6. [Persistência com Drizzle ORM](#6-persistência-com-drizzle-orm)
7. [Validação com Zod](#7-validação-com-zod)
8. [Mensageria com RabbitMQ](#8-mensageria-com-rabbitmq)
9. [Paginação e carregamento infinito](#9-paginação-e-carregamento-infinito)
10. [Testes](#10-testes)
11. [Qualidade de código e padrões](#11-qualidade-de-código-e-padrões)
12. [Observabilidade](#12-observabilidade)
13. [CI/CD](#13-cicd)
14. [Exemplo ponta-a-ponta: módulo `Orders`](#14-exemplo-ponta-a-ponta-módulo-orders)
15. [Roadmap de evolução](#15-roadmap-de-evolução)
16. [Referências](#16-referências)

---

## 1. Visão geral e princípios

Projeto hipotético: **plataforma de pedidos (Orders Platform)** — serve como domínio de exemplo rico o suficiente para ilustrar agregados, eventos de domínio, filas e consultas paginadas.

Princípios norteadores:

- **DDD tático antes de tudo**: entidades, value objects, agregados e repositórios desenhados a partir da linguagem ubíqua do negócio — não do banco.
- **Dependency Rule (Clean Architecture)**: o domínio não conhece infraestrutura. Nest, Drizzle e RabbitMQ são *detalhes*, substituíveis.
- **Tipagem de ponta a ponta**: Zod gera tanto validação de runtime quanto tipos estáticos (`z.infer`), eliminando DTOs duplicados.
- **Assincronismo onde há ganho real**: RabbitMQ para efeitos colaterais (notificações, projeções de leitura, integrações), não para tudo.
- **Paginação pensada desde o início**: contrato estável (`take`/`skip` hoje, cursor amanhã) para suportar scroll infinito no client.

---

## 2. Stack tecnológica

| Camada | Tecnologia | Link |
|---|---|---|
| Framework | NestJS 10+ | https://docs.nestjs.com |
| Linguagem | TypeScript 5+ (strict mode) | https://www.typescriptlang.org/tsconfig |
| ORM | Drizzle ORM | https://orm.drizzle.team |
| Banco | PostgreSQL 16 | https://www.postgresql.org/docs/current/ |
| Validação/Schema | Zod | https://zod.dev |
| Mensageria | RabbitMQ (via `@golevelup/nestjs-rabbitmq`) | https://docs.nestjs.com/microservices/rabbitmq · https://golevelup.github.io/nestjs/modules/rabbitmq.html |
| Migrações | Drizzle Kit | https://orm.drizzle.team/kit-docs/overview |
| Testes | Vitest ou Jest + Testcontainers | https://vitest.dev · https://node.testcontainers.org |
| Lint/Format | ESLint + Prettier | https://eslint.org · https://prettier.io |
| Commits | Conventional Commits + Commitlint | https://www.conventionalcommits.org |
| Observabilidade | OpenTelemetry + Pino | https://opentelemetry.io/docs/languages/js/ · https://getpino.io |
| Containers | Docker Compose (dev) | https://docs.docker.com/compose/ |
| CI | GitHub Actions | https://docs.github.com/actions |

> 💡 Nest tem suporte nativo a RabbitMQ via `@nestjs/microservices`, mas para padrões de pub/sub mais ricos (exchanges, routing keys, RPC) a comunidade costuma preferir `@golevelup/nestjs-rabbitmq`, que embrulha `amqplib`/`amqp-connection-manager` com decorators.

---

## 3. Arquitetura em camadas

Combinação de **Hexagonal Architecture (Ports & Adapters)** com **DDD tático**, dentro de **módulos por bounded context**.

```
┌─────────────────────────────────────────────┐
│          Interface (HTTP, AMQP consumers)    │  ← controllers, message handlers
├─────────────────────────────────────────────┤
│          Application (use cases)             │  ← orquestra, não tem regra de negócio
├─────────────────────────────────────────────┤
│          Domain (entidades, VOs, eventos)     │  ← puro, zero dependência de framework
├─────────────────────────────────────────────┤
│          Infrastructure (Drizzle, RabbitMQ)   │  ← implementa as portas do domínio
└─────────────────────────────────────────────┘
```

Regra de dependência: **as setas de import só apontam para dentro**. `domain/` nunca importa de `infrastructure/`; é o inverso — a infraestrutura implementa interfaces (*ports*) definidas no domínio.

Referências conceituais:
- Eric Evans, *Domain-Driven Design* (o "Livro Azul") — https://www.domainlanguage.com/ddd/blue-book/
- Vaughn Vernon, *Implementing Domain-Driven Design* — https://kalele.io/books/
- Alistair Cockburn, Hexagonal Architecture — https://alistair.cockburn.us/hexagonal-architecture/
- Robert C. Martin, Clean Architecture — https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html

---

## 4. Estrutura de pastas

Organização **por contexto de negócio** (não por tipo técnico), cada bounded context com suas 4 camadas internas:

```
orders-platform/
├── apps/
│   └── api/
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── shared/                      # kernel compartilhado
│       │   │   ├── domain/
│       │   │   │   ├── value-objects/       # Money, Email, Cpf...
│       │   │   │   ├── errors/              # DomainError base
│       │   │   │   └── events/              # DomainEvent base + EventBus port
│       │   │   ├── infrastructure/
│       │   │   │   ├── database/            # drizzle.module.ts, schema barrel
│       │   │   │   ├── messaging/           # rabbitmq.module.ts
│       │   │   │   └── observability/
│       │   │   └── application/
│       │   │       └── pagination/          # PageRequest, CursorPage<T>
│       │   │
│       │   └── modules/
│       │       ├── orders/
│       │       │   ├── domain/
│       │       │   │   ├── order.aggregate.ts
│       │       │   │   ├── order-item.entity.ts
│       │       │   │   ├── order-status.vo.ts
│       │       │   │   ├── order.repository.ts      # port (interface)
│       │       │   │   └── events/
│       │       │   │       └── order-placed.event.ts
│       │       │   ├── application/
│       │       │   │   ├── commands/
│       │       │   │   │   ├── place-order.command.ts
│       │       │   │   │   └── place-order.handler.ts
│       │       │   │   └── queries/
│       │       │   │       ├── list-orders.query.ts
│       │       │   │       └── list-orders.handler.ts
│       │       │   ├── infrastructure/
│       │       │   │   ├── drizzle-order.repository.ts   # adapter
│       │       │   │   ├── order.schema.ts                # tabela drizzle
│       │       │   │   └── order-placed.publisher.ts      # publica no RabbitMQ
│       │       │   ├── interface/
│       │       │   │   ├── http/
│       │       │   │   │   ├── orders.controller.ts
│       │       │   │   │   └── dto/
│       │       │   │   │       ├── create-order.schema.ts  # zod
│       │       │   │   │       └── list-orders.schema.ts
│       │       │   │   └── messaging/
│       │       │   │       └── payment-confirmed.consumer.ts
│       │       │   └── orders.module.ts
│       │       │
│       │       ├── payments/
│       │       └── notifications/
│       │
│       └── test/
│           ├── unit/
│           ├── integration/                 # Testcontainers (pg + rabbitmq)
│           └── e2e/
│
├── drizzle/
│   ├── migrations/
│   └── drizzle.config.ts
├── docker-compose.yml
├── .env.example
├── .eslintrc.cjs
├── .prettierrc
├── commitlint.config.cjs
└── package.json
```

> Se o projeto crescer para microsserviços reais, essa mesma estrutura funciona como **monorepo** (`apps/orders-service`, `apps/payments-service`), usando o [Nest Monorepo mode](https://docs.nestjs.com/cli/monorepo).

---

## 5. Modelagem de domínio (DDD tático)

### 5.1 Blocos de construção

| Conceito | Papel | Exemplo no projeto |
|---|---|---|
| **Entity** | Identidade + ciclo de vida | `OrderItem` |
| **Value Object** | Imutável, igualdade por valor | `Money`, `Email`, `OrderStatus` |
| **Aggregate Root** | Fronteira de consistência transacional | `Order` |
| **Domain Event** | Fato que já ocorreu | `OrderPlacedEvent` |
| **Repository (port)** | Interface de persistência do agregado | `OrderRepository` |
| **Domain Service** | Regra que não pertence a uma única entidade | `PricingService` |
| **Application Service / Use Case** | Orquestra, inicia transação, publica eventos | `PlaceOrderHandler` |

### 5.2 Exemplo: Value Object `Money`

```ts
// shared/domain/value-objects/money.vo.ts
export class Money {
  private constructor(
    private readonly cents: number,
    private readonly currency: 'BRL' | 'USD',
  ) {}

  static fromReais(value: number, currency: 'BRL' | 'USD' = 'BRL'): Money {
    if (value < 0) throw new DomainError('Money cannot be negative');
    return new Money(Math.round(value * 100), currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }

  private assertSameCurrency(other: Money) {
    if (this.currency !== other.currency) {
      throw new DomainError('Cannot operate on different currencies');
    }
  }

  toJSON() {
    return { cents: this.cents, currency: this.currency };
  }
}
```

### 5.3 Exemplo: Aggregate Root `Order`

```ts
// modules/orders/domain/order.aggregate.ts
export class Order {
  private readonly _items: OrderItem[] = [];
  private _status: OrderStatus;
  private readonly _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly id: OrderId,
    private readonly customerId: CustomerId,
  ) {
    this._status = OrderStatus.draft();
  }

  static create(customerId: CustomerId): Order {
    return new Order(OrderId.generate(), customerId);
  }

  addItem(item: OrderItem): void {
    if (!this._status.isDraft()) {
      throw new DomainError('Cannot add items to a placed order');
    }
    this._items.push(item);
  }

  place(): void {
    if (this._items.length === 0) {
      throw new DomainError('Cannot place an order without items');
    }
    this._status = this._status.transitionTo('PLACED');
    this._domainEvents.push(
      new OrderPlacedEvent(this.id, this.customerId, this.total()),
    );
  }

  total(): Money {
    return this._items.reduce(
      (acc, item) => acc.add(item.subtotal()),
      Money.fromReais(0),
    );
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }
}
```

> A regra "não publicar nada sem o agregado ter sido salvo" é garantida na camada de aplicação: `pullDomainEvents()` só é chamado **depois** de o repositório confirmar a persistência (padrão *Transactional Outbox*, seção 8.3).

### 5.4 Repository como *port*

```ts
// modules/orders/domain/order.repository.ts
export abstract class OrderRepository {
  abstract save(order: Order): Promise<void>;
  abstract findById(id: OrderId): Promise<Order | null>;
}
```

O domínio define a interface; `infrastructure/drizzle-order.repository.ts` a implementa e é injetada via token no módulo Nest.

---

## 6. Persistência com Drizzle ORM

### 6.1 Por que Drizzle

- **SQL-first**: query builder que gera SQL previsível, sem "magia" de ORMs tradicionais.
- Schema **TypeScript** vira fonte de verdade de tipos — zero geração de código como no Prisma.
- `drizzle-kit` cuida de migrações versionadas (`drizzle-kit generate` / `drizzle-kit migrate`).
- Documentação: https://orm.drizzle.team/docs/overview · Guia PostgreSQL: https://orm.drizzle.team/docs/get-started-postgresql

### 6.2 Schema

```ts
// modules/orders/infrastructure/order.schema.ts
import { pgTable, uuid, timestamp, integer, pgEnum, varchar, jsonb } from 'drizzle-orm/pg-core';

export const orderStatusEnum = pgEnum('order_status', ['DRAFT', 'PLACED', 'CANCELLED']);

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey(),
  customerId: uuid('customer_id').notNull(),
  status: orderStatusEnum('status').notNull().default('DRAFT'),
  totalCents: integer('total_cents').notNull().default(0),
  currency: varchar('currency', { length: 3 }).notNull().default('BRL'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // Soft delete: pedidos nunca são removidos fisicamente (ver o caso de
  // uso `DeleteOrderUseCase` — só DRAFT/CANCELLED podem ser deletados).
  // `null` = ativo; preenchido = deletado. Uma rotina de purge futura
  // remove definitivamente linhas com `deletedAt` há mais de 30 dias (ver
  // Roadmap, seção 15).
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
});

// Suporte ao padrão de Transactional Outbox (seção 8.3): nenhuma mensagem é
// publicada no RabbitMQ sem antes passar por aqui, na mesma transação do
// agregado.
export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').primaryKey(),
  aggregateType: varchar('aggregate_type', { length: 100 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // Preenchido pelo worker/polling (seção 8.3) assim que a mensagem é
  // publicada com sucesso no RabbitMQ. `null` = ainda pendente de envio.
  processedAt: timestamp('processed_at', { withTimezone: true }),
});
```

### 6.3 Adapter (implementação do port)

```ts
// modules/orders/infrastructure/drizzle-order.repository.ts
@Injectable()
export class DrizzleOrderRepository implements OrderRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async save(order: Order): Promise<void> {
    const snapshot = OrderMapper.toPersistence(order);
    await this.db.transaction(async (tx) => {
      await tx.insert(orders).values(snapshot.order)
        .onConflictDoUpdate({ target: orders.id, set: snapshot.order });
      await tx.delete(orderItems).where(eq(orderItems.orderId, snapshot.order.id));
      if (snapshot.items.length) {
        await tx.insert(orderItems).values(snapshot.items);
      }
    });
  }

  async findById(id: OrderId): Promise<Order | null> {
    const row = await this.db.query.orders.findFirst({
      where: eq(orders.id, id.value),
      with: { items: true },
    });
    return row ? OrderMapper.toDomain(row) : null;
  }
}
```

> O **Mapper** (`OrderMapper`) é peça-chave do DDD: isola o shape relacional do shape do agregado, para que o domínio nunca precise "parecer" com uma tabela.

### 6.4 Migrações

```bash
npx drizzle-kit generate   # gera SQL a partir do schema
npx drizzle-kit migrate    # aplica no banco
npx drizzle-kit studio     # UI para inspecionar dados
```

Referência: https://orm.drizzle.team/kit-docs/overview

---

## 7. Validação com Zod

Zod substitui `class-validator`/`class-transformer`: um único schema define validação de runtime **e** tipo estático.

```ts
// modules/orders/interface/http/dto/create-order.schema.ts
import { z } from 'zod';

export const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
    }),
  ).min(1, 'Order must have at least one item'),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
```

### 7.1 Pipe de validação reutilizável

```ts
// shared/interface/pipes/zod-validation.pipe.ts
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return result.data;
  }
}
```

```ts
@Post()
@UsePipes(new ZodValidationPipe(createOrderSchema))
create(@Body() dto: CreateOrderDto) { ... }
```

Alternativa mais integrada ao ecossistema Nest: [`nestjs-zod`](https://github.com/BenLorantfy/nestjs-zod), que gera `createZodDto` + Swagger automaticamente.

Zod também valida **variáveis de ambiente** no bootstrap (`envSchema.parse(process.env)`), eliminando `undefined` surpresa em produção — ver https://zod.dev/?id=basic-usage.

---

## 8. Mensageria com RabbitMQ

### 8.1 Topologia sugerida

```
orders.events (topic exchange)
 ├── routing key: order.placed      → queue: notifications.order-placed
 ├── routing key: order.placed      → queue: analytics.order-placed
 └── routing key: order.cancelled   → queue: notifications.order-cancelled

orders.events.dlx (dead-letter exchange)
 └── queue: orders.events.dlq
```

- **Topic exchange** permite múltiplos consumidores reagirem ao mesmo evento sem acoplamento.
- **Dead-letter queue** obrigatória: nenhuma fila de produção sem DLQ.

### 8.2 Publisher

```ts
// modules/orders/infrastructure/order-placed.publisher.ts
@Injectable()
export class OrderPlacedPublisher {
  constructor(private readonly amqp: AmqpConnection) {}

  async publish(event: OrderPlacedEvent): Promise<void> {
    await this.amqp.publish('orders.events', 'order.placed', {
      orderId: event.orderId.value,
      customerId: event.customerId.value,
      total: event.total.toJSON(),
      occurredAt: event.occurredAt.toISOString(),
    });
  }
}
```

### 8.3 Transactional Outbox (consistência entre DB e fila)

Problema clássico: salvar o agregado no Postgres e publicar no RabbitMQ **não é atômico** — se o processo cair entre os dois passos, o evento se perde ou duplica.

Solução: tabela `outbox_events` na mesma transação do agregado; um *worker* (ou `pg-boss`/polling) lê a outbox e publica, marcando como enviado.

```ts
await db.transaction(async (tx) => {
  await tx.insert(orders).values(orderRow);
  await tx.insert(outboxEvents).values({
    id: randomUUID(),
    aggregateType: 'Order',
    eventType: 'order.placed',
    payload: event.toJSON(),
    createdAt: new Date(),
  });
});
```

Leitura: https://microservices.io/patterns/data/transactional-outbox.html

### 8.4 Consumer

```ts
// modules/payments/interface/messaging/order-placed.consumer.ts
@Injectable()
export class OrderPlacedConsumer {
  @RabbitSubscribe({
    exchange: 'orders.events',
    routingKey: 'order.placed',
    queue: 'payments.order-placed',
    queueOptions: {
      deadLetterExchange: 'orders.events.dlx',
    },
  })
  async handle(msg: OrderPlacedMessage) {
    // idempotência: checar se já processado antes de agir
  }
}
```

> **Idempotência é obrigatória**: RabbitMQ garante *at-least-once delivery*, nunca *exactly-once*. Toda mensagem deve carregar um `messageId`/`eventId` e os consumidores devem checar duplicidade (tabela `processed_messages` ou similar).

Referências:
- https://www.rabbitmq.com/tutorials (tutoriais oficiais, especialmente Topics e RPC)
- https://www.rabbitmq.com/docs/reliability
- https://golevelup.github.io/nestjs/modules/rabbitmq.html

---

## 9. Paginação e carregamento infinito

### 9.1 Fase 1 — offset-based (`take`/`skip`)

Simples, suficiente no início, mas degrada em tabelas grandes (`OFFSET` alto é caro).

```ts
// shared/application/pagination/page-request.ts
export const pageRequestSchema = z.object({
  take: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).default(0),
});
export type PageRequest = z.infer<typeof pageRequestSchema>;

export interface Page<T> {
  items: T[];
  total: number;
  take: number;
  skip: number;
  hasMore: boolean;
}
```

```ts
async listOrders({ take, skip }: PageRequest): Promise<Page<OrderSummary>> {
  const [items, [{ count }]] = await Promise.all([
    this.db.select().from(orders).limit(take).offset(skip).orderBy(desc(orders.createdAt)),
    this.db.select({ count: sql<number>`count(*)` }).from(orders),
  ]);
  return { items, total: Number(count), take, skip, hasMore: skip + items.length < Number(count) };
}
```

### 9.2 Fase 2 — cursor-based (evolução recomendada)

Quando o volume crescer, migrar para **keyset pagination**: usa o último valor ordenado (ex.: `createdAt` + `id` como tie-breaker) como cursor opaco (base64), sem `OFFSET`.

```ts
export const cursorPageRequestSchema = z.object({
  take: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(), // base64({ createdAt, id })
});
```

```ts
async listOrdersByCursor({ take, cursor }: CursorPageRequest) {
  const decoded = cursor ? decodeCursor(cursor) : null;
  const items = await this.db
    .select()
    .from(orders)
    .where(decoded
      ? or(
          lt(orders.createdAt, decoded.createdAt),
          and(eq(orders.createdAt, decoded.createdAt), lt(orders.id, decoded.id)),
        )
      : undefined)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(take + 1); // +1 para saber se há próxima página

  const hasMore = items.length > take;
  const page = hasMore ? items.slice(0, take) : items;
  return {
    items: page,
    nextCursor: hasMore ? encodeCursor(page.at(-1)!) : null,
  };
}
```

> Mantendo o **mesmo contrato de resposta no controller** (`items`, `nextCursor`/`hasMore`), a migração de `skip` para `cursor` é transparente para o frontend — só muda o parâmetro de entrada.

Leituras recomendadas:
- https://use-the-index-luke.com/no-offset (clássico sobre por que evitar OFFSET)
- https://relay.dev/graphql/connections.htm (spec de Cursor Connections, inspiração mesmo fora de GraphQL)
- https://www.postgresql.org/docs/current/queries-limit.html

---

## 10. Testes

| Tipo | Escopo | Ferramenta | O quê |
|---|---|---|---|
| Unitário | Domínio puro | Vitest/Jest | `Order`, `Money`, VOs — sem I/O |
| Integração | Repository + schema real | Testcontainers (Postgres) | Mapper + queries Drizzle |
| Integração | Publisher/Consumer | Testcontainers (RabbitMQ) | Round-trip de mensagens |
| E2E | HTTP completo | Supertest | Fluxo de criação de pedido |
| Contrato | Schemas Zod | Vitest | Garantir que schema aceita/rejeita payloads esperados |

```ts
// test/integration/orders.repository.spec.ts
describe('DrizzleOrderRepository', () => {
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16').start();
    await runMigrations(container.getConnectionUri());
  });

  it('persists and retrieves an order with items', async () => {
    const order = Order.create(CustomerId.generate());
    order.addItem(OrderItem.create(ProductId.generate(), 2, Money.fromReais(50)));
    await repository.save(order);

    const found = await repository.findById(order.id);
    expect(found?.total().equals(Money.fromReais(100))).toBe(true);
  });

  afterAll(() => container.stop());
});
```

Testcontainers sobe Postgres/RabbitMQ reais via Docker durante o teste — nada de mocks de banco que mentem sobre comportamento SQL.

Referências:
- https://node.testcontainers.org
- https://docs.nestjs.com/fundamentals/testing
- Padrão *Test Pyramid*: https://martinfowler.com/articles/practical-test-pyramid.html

---

## 11. Qualidade de código e padrões

- **ESLint** com `@typescript-eslint` + regras de import boundary (`eslint-plugin-boundaries` ou `eslint-plugin-import` com zonas) para **impedir que `domain/` importe de `infrastructure/`** — a dependency rule virando lint, não só convenção.
- **Prettier** para formatação, sem debate de estilo.
- **Conventional Commits** (`feat:`, `fix:`, `refactor:`) + `commitlint` + `husky` (pre-commit roda lint/test).
- **Barrel files** (`index.ts`) por módulo para expor só a *fachada pública* (ex.: `orders.module.ts`, DTOs) — detalhes internos do domínio não vazam.
- Nomenclatura DDD consistente: `*.aggregate.ts`, `*.entity.ts`, `*.vo.ts`, `*.repository.ts` (port), `*.repository.impl.ts` ou pasta `infrastructure/` (adapter).

Links:
- https://typescript-eslint.io
- https://commitlint.js.org
- https://typicode.github.io/husky/

---

## 12. Observabilidade

- **Logs estruturados**: Pino + `nestjs-pino` (JSON logs, correlação por `requestId`).
- **Tracing distribuído**: OpenTelemetry instrumentando HTTP, Drizzle (via `pg` instrumentation) e RabbitMQ — essencial para rastrear um evento desde o `POST /orders` até o consumer de pagamento.
- **Health checks**: `@nestjs/terminus` para `/health` (DB, RabbitMQ).

Links:
- https://github.com/iamolegga/nestjs-pino
- https://opentelemetry.io/docs/languages/js/getting-started/nodejs/
- https://docs.nestjs.com/recipes/terminus

---

## 13. CI/CD

Pipeline mínimo (GitHub Actions):

```yaml
# .github/workflows/ci.yml
name: CI
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: postgres }
        ports: ['5432:5432']
      rabbitmq:
        image: rabbitmq:3-management
        ports: ['5672:5672']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm run test:unit
      - run: npm run test:integration
```

Referência: https://docs.github.com/actions/use-cases-and-examples/building-and-testing/building-and-testing-nodejs

---

## 14. Exemplo ponta-a-ponta: módulo `Orders`

Fluxo completo de uma requisição `POST /orders`:

```
1. OrdersController recebe payload
2. ZodValidationPipe valida contra createOrderSchema
3. PlaceOrderHandler (use case):
   a. monta o Aggregate Order
   b. chama order.addItem() / order.place() → regras de domínio aplicadas
   c. repository.save(order) → grava Order + OrderItems + OutboxEvent (1 transação)
4. OutboxWorker lê outbox → publica OrderPlacedEvent no RabbitMQ
5. payments.order-placed consumer reage (ex.: inicia cobrança)
6. notifications.order-placed consumer reage (ex.: envia e-mail)
```

```ts
// modules/orders/interface/http/orders.controller.ts
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly placeOrder: PlaceOrderHandler,
    private readonly listOrders: ListOrdersHandler,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createOrderSchema))
  async create(@Body() dto: CreateOrderDto) {
    const orderId = await this.placeOrder.execute(dto);
    return { orderId };
  }

  @Get()
  async list(@Query(new ZodValidationPipe(pageRequestSchema)) query: PageRequest) {
    return this.listOrders.execute(query);
  }
}
```

### 14.1 Por que não há `PUT`/`PATCH /orders/:id` genérico

O módulo `Orders` **não expõe uma rota de atualização genérica**. Toda mutação do agregado é um comando explícito, cada um com sua própria invariante de domínio (seção 5.3) — não existe (nem deveria existir) um `order.update(partialData)` que aceite um body livre e decida por fora quais campos podem mudar em qual status:

| Rota | Use case / regra |
|---|---|
| `POST /orders` | `MakeOrderUseCase` — cria e já confirma o pedido (`place()`) |
| `POST\|PATCH /orders/:id/items` | `addItem()` — só em `DRAFT` |
| `DELETE /orders/:id/items/:itemId` | `removeItem()` — só em `DRAFT` |
| `POST /orders/:id/place` | `place()` — `DRAFT` → `PLACED` |
| `POST /orders/:id/cancel` | `cancel()` — `DRAFT`/`PLACED` → `CANCELLED` (pedido `PLACED` só pode ser cancelado até 1h após confirmado — ver `ORDER_CANCELLATION_WINDOW_MS`) |
| `DELETE /orders/:id` | `delete()` — soft delete, só `DRAFT`/`CANCELLED` (ver seção 6.2) |

Um `PUT`/`PATCH /orders/:id` genérico duplicaria (ou, pior, contornaria) as transições já garantidas por `OrderStatus.canTransitionTo` e pelos guards do agregado (`assertIsDraft`, etc.), além de não mapear para nenhum comando real da linguagem ubíqua do domínio — e conflitaria diretamente com a imutabilidade do pedido após `PLACED`. O método `OrdersRepository.update()` existe apenas como **detalhe de persistência**, usado internamente pelos handlers depois que o agregado já validou a transição; não é — nem deve virar — um verbo HTTP exposto 1:1.

---

## 15. Roadmap de evolução

- [ ] Expor edição de um pedido ainda em rascunho (`DRAFT`) via use cases
      dedicados (`AddOrderItemUseCase`, `RemoveOrderItemUseCase`, um use
      case para `Order.changeItemQuantity`). Os métodos `addItem`,
      `removeItem` e `changeItemQuantity` já existem no agregado `Order` e
      são testados isoladamente, mas hoje nenhum use case os chama —
      `MakeOrderUseCase` monta os itens direto em `Order.create` e sempre
      confirma (`place()`) na mesma operação, então nenhum `DRAFT` é
      persistido pela camada de aplicação atualmente.
- [ ] Migrar paginação offset → cursor quando a tabela `orders` passar de ~500k linhas.
- [ ] Introduzir **CQRS** mais formal (`@nestjs/cqrs`) se `queries` de leitura precisarem de modelos de projeção próprios (read models desnormalizados). Plano concreto já esboçado: um `OrderSummary` (DTO plano, sem as invariantes do agregado `Order`) com seu próprio `OrderSummariesRepository`/`DrizzleOrderSummariesRepository` e um `ListOrderSummariesUseCase` paralelo ao `FindManyOrdersUseCase` — é ali, não no `OrdersRepository` do agregado, que `OrderFilters` (seção 6, `core/repositories/order-filters.ts`) finalmente passaria a reduzir colunas de verdade no `SELECT` (e pular o `JOIN`/subquery com `order_items` quando `items` não for pedido). `OrdersRepository.findManyWithFilters` continua existindo só para quando o agregado completo é necessário (ex.: carregar para chamar `order.cancel()`).
- [ ] Avaliar **Event Sourcing** apenas se o histórico de mudanças do agregado virar requisito de negócio (não antecipar sem necessidade real).
- [ ] Multi-tenancy, se aplicável, via schema-per-tenant ou coluna `tenant_id` + RLS do Postgres.
- [ ] Rate limiting (`@nestjs/throttler`) e API versioning antes de expor publicamente.
- [ ] Rotina periódica (worker ou job agendado) que faz o purge definitivo de pedidos com soft delete (`deletedAt`) há mais de 30 dias — hoje `DeleteOrderUseCase` só marca `deletedAt`, nunca remove a linha de fato (ver seção 6.2).

---

## 16. Referências

**NestJS**
- Docs oficiais: https://docs.nestjs.com
- Modules & DI: https://docs.nestjs.com/modules

**DDD**
- Eric Evans — *Domain-Driven Design*: https://www.domainlanguage.com/ddd/blue-book/
- Vaughn Vernon — *Implementing DDD*: https://kalele.io/books/
- Martin Fowler sobre agregados: https://martinfowler.com/bliki/DDD_Aggregate.html

**Drizzle**
- https://orm.drizzle.team/docs/overview
- https://orm.drizzle.team/kit-docs/overview

**Zod**
- https://zod.dev
- nestjs-zod: https://github.com/BenLorantfy/nestjs-zod

**RabbitMQ**
- https://www.rabbitmq.com/tutorials
- https://www.rabbitmq.com/docs/reliability
- Transactional Outbox: https://microservices.io/patterns/data/transactional-outbox.html

**Paginação**
- https://use-the-index-luke.com/no-offset
- https://relay.dev/graphql/connections.htm

**Testes**
- https://node.testcontainers.org
- https://martinfowler.com/articles/practical-test-pyramid.html
