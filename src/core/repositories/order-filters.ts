/**
 * Única fonte da verdade para os campos projetáveis de `Order`. A lista é
 * usada tanto para derivar o tipo `ProductFilters` quanto, em runtime, para
 * validar o parâmetro `fields` da query string na camada HTTP (ver
 * `find-product.schema.ts`) — evita que tipo e validação fiquem fora de
 * sincronia conforme novos campos forem adicionados.
 */
export const ORDER_FILTER_FIELDS = ['customerId', 'items', 'status', 'createdAt', 'updatedAt'] as const;

export type OrderFilterField = (typeof ORDER_FILTER_FIELDS)[number];

export type OrderFilters = Partial<Record<OrderFilterField, boolean>>;
