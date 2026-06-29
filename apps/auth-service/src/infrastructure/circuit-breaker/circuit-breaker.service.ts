import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';

interface CircuitBreakerOptions {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  getBreaker(
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action: (...args: any[]) => Promise<any>,
    options?: Partial<CircuitBreakerOptions>,
  ): CircuitBreaker {
    const defaultOptions: CircuitBreakerOptions = {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 10000,
      ...options,
    };

    const breaker = new CircuitBreaker(action, defaultOptions);

    // Event listeners
    breaker.on('open', () => {
      this.logger.warn(`Circuit breaker ${name} opened`);
    });

    breaker.on('halfOpen', () => {
      this.logger.log(`Circuit breaker ${name} half-open`);
    });

    breaker.on('close', () => {
      this.logger.log(`Circuit breaker ${name} closed`);
    });

    return breaker;
  }

  async execute<T>(
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action: (...args: any[]) => Promise<T>,
    fallback?: () => T,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ): Promise<T> {
    const breaker = this.getBreaker(name, action);

    try {
      return await breaker.fire(...args);
    } catch (error) {
      this.logger.error(`Circuit breaker ${name} failed:`, error);
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }
}
