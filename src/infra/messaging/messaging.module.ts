import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';

import { ORDERS_EXCHANGE } from '@/core/consts/messaging.consts';
import { Logger as LoggerPort } from '@/domain/application/shared/gateways/logger';
import { Queue } from '@/domain/application/shared/gateways/queue';
import { EnvModule } from '@/infra/shared/env/env.module';
import { EnvService } from '@/infra/shared/env/env.service';

import { NestLoggerAdapter } from '../logging/nest-logger.adapter';
import { RabbitMqQueueGateway } from './rabbitmq-queue.gateway';

/**
 * Wiring de infra de mensageria (README, seção 8) e de observabilidade
 * de falhas de publish — os dois vivem no mesmo módulo porque existem
 * pelo mesmo motivo (ver PRD `rabbitmq-infra-wiring`, "Decisões
 * técnicas", item 4).
 *
 * Declara só a exchange `orders.events` (topic). Nenhuma fila é
 * declarada aqui — nenhum bounded context consome essas mensagens ainda
 * (ver PRD, "Fora de escopo"); `Queue.consume` é implementado porque o
 * port exige, mas nada neste módulo chama/registra uma fila real.
 */
@Module({
  imports: [
    EnvModule,
    RabbitMQModule.forRootAsync({
      imports: [EnvModule],
      inject: [EnvService],
      useFactory: (envService: EnvService) => ({
        uri: envService.get('RABBITMQ_URL'),
        exchanges: [{ name: ORDERS_EXCHANGE, type: 'topic' }],
      }),
    }),
  ],
  providers: [
    { provide: Queue, useClass: RabbitMqQueueGateway },
    { provide: LoggerPort, useClass: NestLoggerAdapter },
  ],
  exports: [Queue, LoggerPort],
})
export class MessagingModule {}
