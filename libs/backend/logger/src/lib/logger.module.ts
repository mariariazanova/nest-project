import {
  DynamicModule,
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ClsModule, ClsService } from 'nestjs-cls';
import {
  CorrelationMiddleware,
  CORRELATION_ID_KEY,
} from './correlation.middleware';
import { LoggerModuleOptions } from './logger.options';
import { LoggingInterceptor } from './logging.interceptor';

export const LOGGER_OPTIONS = Symbol('LOGGER_OPTIONS');

@Global()
@Module({})
export class LoggerModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }

  static forRoot(options: LoggerModuleOptions): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        ClsModule.forRoot({ middleware: { mount: false } }),

        PinoLoggerModule.forRootAsync({
          useFactory: (cls: ClsService) => ({
            pinoHttp: {
              level:
                process.env['NODE_ENV'] !== 'production' ? 'debug' : 'info',
              transport:
                process.env['NODE_ENV'] !== 'production'
                  ? {
                      target: 'pino-pretty',
                      options: { colorize: true, singleLine: true },
                    }
                  : undefined,
              serializers: {
                req: (req) => ({
                  method: req.method,
                  url: req.url,
                }),
                res: (res) => ({ statusCode: res.statusCode }),
              },
              redact: {
                paths: ['req.headers.authorization', 'req.headers.cookie'],
                censor: '[REDACTED]',
              },
              mixin: () => ({
                service: options.serviceName,
                correlationId: cls.get(CORRELATION_ID_KEY),
              }),
            },
          }),
          inject: [ClsService],
        }),
      ],
      providers: [
        { provide: LOGGER_OPTIONS, useValue: options },
        CorrelationMiddleware,
        LoggingInterceptor,
        { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
      ],
      exports: [ClsModule],
    };
  }
}
