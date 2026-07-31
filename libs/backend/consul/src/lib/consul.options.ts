export interface ConsulModuleOptions {
  serviceName: string;
  servicePort: number;
  tags?: string[];
}

export const CONSUL_OPTIONS = 'CONSUL_OPTIONS';
