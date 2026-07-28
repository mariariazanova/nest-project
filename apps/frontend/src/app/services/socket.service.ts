import { Injectable, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

const WS_URL = environment.apiBaseUrl.replace(/\/v1\/?$/, '');

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;

  connect(token: string): void {
    if (this.socket?.connected) return;

    this.socket = io(`${WS_URL}/ws`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    this.socket.on('connect', () => {
      this.socket?.emit('join');
    });
  }

  on<T>(event: string): Observable<T> {
    return new Observable<T>((observer) => {
      if (!this.socket) {
        observer.error(
          new Error('Socket not connected. Call connect() first.'),
        );
        return;
      }

      const handler = (data: T) => observer.next(data);
      this.socket.on(event, handler);

      return () => {
        this.socket?.off(event, handler);
      };
    });
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
