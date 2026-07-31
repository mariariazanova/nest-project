import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';

export interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorFilter?: (error: any) => boolean;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreaker>();

  getBreaker(
    name: string,
    // action is accepted for backward compatibility but ignored — the breaker
    // dispatches through a generic thunk so each fire() call gets its own action
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _action?: (...args: any[]) => Promise<any>,
    options?: Partial<CircuitBreakerOptions>,
  ): CircuitBreaker {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    this.logger.debug(`Creating circuit breaker: ${name}`);

    const defaultOptions: CircuitBreakerOptions = {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 10000,
      volumeThreshold: 5,
      ...options,

      errorFilter:
        options?.errorFilter ??
        ((error: any) => {
          if (error.response?.status) {
            const status = error.response.status;
            if (status >= 400 && status < 500) {
              this.logger.debug(
                `Ignoring 4xx error (${status}) for circuit breaker`,
              );
              return true;
            }
          }
          return false;
        }),
    };

    // The breaker wraps a generic thunk dispatcher so every fire() call
    // executes the action supplied at call time, not the one from creation.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const thunk = (fn: () => Promise<any>) => fn();
    const breaker = new CircuitBreaker(thunk, defaultOptions);

    breaker.on('open', () => {
      this.logger.warn(`Circuit breaker ${name} opened`);
    });

    breaker.on('halfOpen', () => {
      this.logger.log(`Circuit breaker ${name} half-open`);
    });

    breaker.on('close', () => {
      this.logger.log(`Circuit breaker ${name} closed`);
    });

    this.breakers.set(name, breaker);
    return breaker;
  }

  async execute<T>(
    name: string,
    action: () => Promise<T>,
    fallback?: () => T,
  ): Promise<T> {
    const breaker = this.getBreaker(name);

    try {
      return (await breaker.fire(action)) as T;
    } catch (error) {
      this.logger.error(`Circuit breaker ${name} failed:`, error);
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }
}
