import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConsulService } from './consul.service';
import { CONSUL_OPTIONS, ConsulModuleOptions } from './consul.options';

@Global()
@Module({})
export class ConsulModule {
  static forRoot(options: ConsulModuleOptions): DynamicModule {
    return {
      module: ConsulModule,
      providers: [
        { provide: CONSUL_OPTIONS, useValue: options },
        ConsulService,
      ],
      exports: [ConsulService],
    };
  }
}
