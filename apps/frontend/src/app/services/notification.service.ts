import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly message = signal<string | null>(null);

  private timer: ReturnType<typeof setTimeout> | null = null;

  show(text: string, durationMs = 5000): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.message.set(text);
    this.timer = setTimeout(() => this.message.set(null), durationMs);
  }

  dismiss(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.message.set(null);
  }
}
