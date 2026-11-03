import * as drizzle from 'drizzle-orm';

import * as orderSchema from './order.schema';
import * as orderItemSchema from './order-item.schema';

/**
 * Agregador central de todos os schemas da aplicação
 *
 * VANTAGENS:
 * - Single Source of Truth para todos os schemas
 * - Facilita manutenção e adição de novos schemas
 * - Permite tree-shaking automático dos schemas não utilizados
 * - Centraliza a configuração de relacionamentos
 */
export const schemas = {
  order: orderSchema,
  orderItem: orderItemSchema,
} as const;

/**
 * Type utility para extrair tabelas de schemas individuais
 * Filtra apenas propriedades que são instâncias de tabelas Drizzle
 */
type ExtractTablesFromSchema<T> = {
  [K in keyof T]: T[K] extends drizzle.Table ? T[K] : never;
}[keyof T];

/**
 * Mapeia cada schema para sua respectiva tabela principal
 * Assume que cada schema exporta uma única tabela principal
 */
type SchemaToTableMapping = {
  [K in keyof typeof schemas]: ExtractTablesFromSchema<(typeof schemas)[K]>;
};

/**
 * Schema principal do banco de dados gerado automaticamente
 * Este tipo é inferido dinamicamente baseado nos schemas importados
 */
export type DatabaseSchema = SchemaToTableMapping;

export const buildDrizzleSchema = (): DatabaseSchema => {
  return {
    order: orderSchema.orders,
    orderItem: orderItemSchema.orderItems,
  };
};

export const drizzleSchemaConfig = buildDrizzleSchema();

/**
 * Type utility para acessar tabelas específicas com type safety
 */
export type TableReference<T extends keyof DatabaseSchema> = DatabaseSchema[T];
