import { OrderFilters } from '@/core/repositories/order-filters';
import { Order } from '@/domain/enterprise/entities/order';

export abstract class OrdersRepository {
  abstract create(order: Order): Promise<void>;
  abstract findById(id: string): Promise<Order | null>;
  abstract findManyWithFilters(filters?: OrderFilters): Promise<Order[]>;

  /**
   * Persiste um agregado já existente. Também é o método usado para
   * soft delete: `DeleteOrderUseCase` chama `order.delete()` (que apenas
   * marca `deletedAt` no agregado, ver README seção 6.2) e persiste o
   * resultado através de `update`, nunca de `delete`.
   */
  abstract update(order: Order): Promise<void>;

  /**
   * Remoção física e definitiva. Não é usada pelo caso de uso de deletar
   * pedido (que faz soft delete via `update`) — fica reservada para uma
   * futura rotina de purge que remova permanentemente pedidos já
   * soft-deletados há mais de 30 dias.
   */
  abstract delete(id: string): Promise<void>;
}
