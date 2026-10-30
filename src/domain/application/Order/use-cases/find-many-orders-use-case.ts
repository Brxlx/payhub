import { PaginationParamsConsts } from '@/core/consts/pagination.consts';
import { PaginationParams } from '@/core/repositories/paginations-params';
import { Either, left, right } from '@/core/types/either';
import { OrderError } from '@/domain/enterprise/entities/errors/order.error';
import { Order } from '@/domain/enterprise/entities/order';

import { OrdersRepository } from '../repositories/orders.repository';

type FindManyOrdersUseCaseRequest = PaginationParams;

interface FindManyOrdersUseCaseResponsePayload {
  orders: Order[];
  total: number;
  page: number;
  itemsPerPage: number;
  hasMore: boolean;
}

type FindManyOrdersUseCaseResponse = Either<OrderError, FindManyOrdersUseCaseResponsePayload>;

/**
 * Lista pedidos de forma paginada.
 *
 * Não recebe filtros de projeção de campos (`OrderFilters`): este
 * repositório devolve o agregado `Order` completo (ver `OrdersRepository`),
 * e um agregado parcial violaria suas próprias invariantes (ex.:
 * `Order.total` depende de `items`). Projeção de campos só faz sentido num
 * read model dedicado, fora do agregado.
 *
 * A divisão de responsabilidades aqui é: este use case decide a *política*
 * de paginação (defaults e limites de `page`/`itemsPerPage` — ver
 * `resolvePagination`), enquanto a *mecânica* de paginar os dados (fatiar
 * o resultado e calcular `hasMore`) é responsabilidade de quem executa a
 * query, dentro de `OrdersRepository.findManyWithFilters` — este use case
 * nunca recalcula o que o repositório já calculou.
 */
export class FindManyOrdersUseCase {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  async execute({
    page,
    itemsPerPage,
  }: FindManyOrdersUseCaseRequest): Promise<FindManyOrdersUseCaseResponse> {
    const paginationOrError = this.resolvePagination(page, itemsPerPage);

    if (paginationOrError.isLeft()) {
      return left(paginationOrError.value);
    }

    const pagination = paginationOrError.value;

    const { orders, total, hasMore } = await this.ordersRepository.findManyWithFilters({ pagination });

    return right({
      orders,
      total,
      page: pagination.page,
      itemsPerPage: pagination.itemsPerPage,
      hasMore,
    });
  }

  /**
   * Aplica defaults (`page=1`, `itemsPerPage=20`) e valida os limites
   * (`page` positivo, `itemsPerPage` entre 1 e 100) antes de delegar ao
   * repositório — mesmo range usado como exemplo no README (seção 9.1).
   */
  private resolvePagination(
    page?: number,
    itemsPerPage?: number,
  ): Either<OrderError, Required<PaginationParams>> {
    const resolvedPage = page ?? PaginationParamsConsts.DEFAULT_PAGE;
    const resolvedItemsPerPage = itemsPerPage ?? PaginationParamsConsts.DEFAULT_ITEMS_PER_PAGE;

    if (!Number.isInteger(resolvedPage) || resolvedPage < 1) {
      return left(new OrderError('page must be a positive integer'));
    }

    if (
      !Number.isInteger(resolvedItemsPerPage) ||
      resolvedItemsPerPage < 1 ||
      resolvedItemsPerPage > PaginationParamsConsts.MAX_ITEMS_PER_PAGE
    ) {
      return left(
        new OrderError(
          `itemsPerPage must be an integer between 1 and ${PaginationParamsConsts.MAX_ITEMS_PER_PAGE}`,
        ),
      );
    }

    return right({ page: resolvedPage, itemsPerPage: resolvedItemsPerPage });
  }
}
