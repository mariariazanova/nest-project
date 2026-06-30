import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';

interface CircuitBreakerOptions {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorFilter: (error: any) => boolean;
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
    this.logger.debug(`CircuitBreakerService ${name} with name ${name}`);

    const defaultOptions: CircuitBreakerOptions = {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 10000,
      ...options,
      errorFilter: (error) => {
        // If it's error Axios form response
        if (error.response?.status) {
          const status = error.response.status;
          // Ignore errors of client (4xx) - they aren't service errors
          if (status >= 400 && status < 500) {
            this.logger.debug(`Ignoring 4xx error (${status}) for circuit breaker`);

            return true; // not an error
          }
        }
        // Take into consideration only 5xx, timeouts, connection errors
        return false;
      },
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
      return await breaker.fire(...args) as T;
    } catch (error) {
      this.logger.error(`Circuit breaker ${name} failed:`, error);
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }
}
