import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Consul from 'consul';

@Injectable()
export class ConsulService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConsulService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private consul: any;
  private serviceId: string;
  private checkInterval: NodeJS.Timeout;

  constructor(private config: ConfigService) {
    this.consul = new Consul({
      host: this.config.get('CONSUL_HOST', 'localhost'),
      port: parseInt(this.config.get('CONSUL_PORT', '8500')),
    });

    this.serviceId = `suggestion-service-${process.env.HOSTNAME || 'local'}-${Date.now()}`;
  }

  async onModuleInit() {
    await this.registerService();
  }

  async onModuleDestroy() {
    await this.deregisterService();
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  async registerService() {
    try {
      const serviceName = 'suggestion-service';
      const servicePort = parseInt(this.config.get('PORT', '3002'));
      const serviceHost = process.env.SERVICE_HOST || 'suggestion-service';

      await this.consul.agent.service.register({
        id: this.serviceId,
        name: serviceName,
        address: serviceHost,
        port: servicePort,
        check: {
          http: `http://${serviceHost}:${servicePort}/health`,
          interval: '10s',
          timeout: '5s',
          deregistercriticalserviceafter: '30s',
        },
        tags: ['suggestion', 'microservice', 'nestjs'],
      });

      this.logger.log(`Service registered with Consul: ${this.serviceId}`);

      // Periodic health check
      this.checkInterval = setInterval(async () => {
        try {
          const health = await this.consul.health.service(serviceName);
          this.logger.debug(`Health check: ${health.length} instances healthy`);
        } catch (error) {
          this.logger.error('Health check failed', error);
        }
      }, 30000);
    } catch (error) {
      this.logger.error('Failed to register with Consul', error);
    }
  }

  async deregisterService() {
    try {
      await this.consul.agent.service.deregister(this.serviceId);
      this.logger.log(`Service deregistered from Consul: ${this.serviceId}`);
    } catch (error) {
      this.logger.error('Failed to deregister from Consul', error);
    }
  }

  async discoverService(serviceName: string): Promise<string | null> {
    try {
      const services = await this.consul.health.service({
        service: serviceName,
        passing: true,
      });

      if (services.length === 0) {
        this.logger.warn(`No healthy instances found for service: ${serviceName}`);
        return null;
      }

      // Simple round-robin
      const service = services[Math.floor(Math.random() * services.length)];
      const address = service.Service.Address || service.Node.Address;
      const port = service.Service.Port;

      return `http://${address}:${port}`;
    } catch (error) {
      this.logger.error(`Failed to discover service: ${serviceName}`, error);
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getConfig(key: string): Promise<any> {
    try {
      const result = await this.consul.kv.get(key);
      return result ? JSON.parse(result.Value) : null;
    } catch (error) {
      this.logger.error(`Failed to get config: ${key}`, error);
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async setConfig(key: string, value: any): Promise<void> {
    try {
      await this.consul.kv.set(key, JSON.stringify(value));
      this.logger.log(`Config set: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to set config: ${key}`, error);
    }
  }
}
