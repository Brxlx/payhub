import { OrderFilters } from '@/core/repositories/order-filters';
import { Order } from '@/domain/enterprise/entities/order';

export abstract class OrdersRepository {
  abstract create(order: Order): Promise<void>;
  abstract findById(id: string): Promise<Order | null>;
  abstract findManyWithFilters(filters?: OrderFilters): Promise<Order[]>;
  abstract update(order: Order): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
