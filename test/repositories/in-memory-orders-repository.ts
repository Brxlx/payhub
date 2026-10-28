/* eslint-disable @typescript-eslint/require-await */
import { OrderFilters } from '@/core/repositories/order-filters';
import { OrdersRepository } from '@/domain/application/Order/repositories/orders.repository';
import { DomainEvents } from '@/domain/application/shared/events/domain-events';
import { Order } from '@/domain/enterprise/entities/order';

/**
 * Double de `OrdersRepository` para uso em testes (unitários de use-case,
 * por exemplo), sem tocar em banco de dados real. Mantém os agregados em
 * memória, indexados pelo próprio id — evita varredura linear (`find`) a
 * cada lookup, igual uma tabela indexada por chave primária faria.
 */
export class InMemoryOrdersRepository implements OrdersRepository {
  public items = new Map<string, Order>();

  async create(order: Order): Promise<void> {
    this.items.set(order.id.toValue(), order);

    // Simula o que a implementação real (Drizzle) deve fazer após o commit
    // da transação: disparar os domain events marcados pelo agregado — ver
    // TODO em `MakeOrderUseCase.persistOrder`.
    DomainEvents.dispatchEventsForAggregate(order.id);
  }

  async findById(id: string): Promise<Order | null> {
    return this.items.get(id) ?? null;
  }

  async findManyWithFilters(filters?: OrderFilters): Promise<Order[]> {
    // `OrderFilters` hoje descreve quais campos projetar (uso típico de
    // query SQL), não critérios de busca — como aqui trabalhamos com os
    // agregados completos em memória, não há o que reduzir. Mantido apenas
    // para respeitar a assinatura do port.
    void filters;

    return Array.from(this.items.values());
  }

  async update(order: Order): Promise<void> {
    if (!this.items.has(order.id.toValue())) {
      return;
    }

    this.items.set(order.id.toValue(), order);

    DomainEvents.dispatchEventsForAggregate(order.id);
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}
