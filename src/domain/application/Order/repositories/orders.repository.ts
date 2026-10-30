import { PaginationParams } from '@/core/repositories/paginations-params';
import { Order } from '@/domain/enterprise/entities/order';

export interface FindManyOrdersParams {
  pagination: Required<PaginationParams>;
}

export interface FindManyOrdersResult {
  orders: Order[];
  total: number;
  hasMore: boolean;
}

export abstract class OrdersRepository {
  abstract create(order: Order): Promise<void>;
  abstract findById(id: string): Promise<Order | null>;

  /**
   * Busca paginada de pedidos, devolvendo o agregado `Order` completo.
   * `pagination` sempre chega já resolvida (com defaults e limites
   * aplicados por `FindManyOrdersUseCase`) — este port nunca decide
   * defaults de paginação sozinho. `total` é a contagem geral (sem
   * paginação aplicada); `hasMore` já vem calculado por quem executa a
   * query (tem os limites da página ali mesmo) — quem chama este método
   * não deve recalculá-lo.
   *
   * Não aceita projeção de campos (`OrderFilters`): como o retorno é
   * sempre o agregado completo, não há "menos campos" possível sem violar
   * as invariantes do próprio `Order` (ex.: `total` depende de `items`).
   * Isso só faz sentido num read model dedicado (DTO plano, fora do
   * agregado) — ver roadmap do README, seção 15 (CQRS).
   */
  abstract findManyWithFilters(params: FindManyOrdersParams): Promise<FindManyOrdersResult>;

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
