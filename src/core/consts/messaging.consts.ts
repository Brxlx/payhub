/**
 * Topologia de mensageria descrita no README, seção 8.1. Única fonte de
 * verdade para nomes de exchange e routing keys — tanto os eventos de
 * domínio (`eventName`, ver `DomainEvent`) quanto o futuro publisher
 * RabbitMQ (infra) devem referenciar estas constantes, nunca redigitar
 * as strings.
 */
export const ORDERS_EXCHANGE = 'orders.events';

export const ORDER_ROUTING_KEYS = {
  PLACED: 'order.placed',
  CANCELLED: 'order.cancelled',
} as const;
