/**
 * Janela de tempo, a partir da confirmação (`place()`), em que um pedido
 * `PLACED` ainda pode ser cancelado. Após esse limite, `Order.cancel()`
 * recusa a transição — regra de negócio, não limitação técnica. Não se
 * aplica a pedidos `DRAFT` (nunca confirmados, sem `placedAt`).
 */
export const ORDER_CANCELLATION_WINDOW_MS = 60 * 60 * 1000; // 1 hora

/**
 * Número de horas para a janela de tempo de cancelamento de um pedido `PLACED`.
 * @see {@link ORDER_CANCELLATION_WINDOW_MS}
 */
export const ORDER_CANCELLATION_WINDOW_HOURS = ORDER_CANCELLATION_WINDOW_MS / (60 * 60 * 1000); // 1 hora;
