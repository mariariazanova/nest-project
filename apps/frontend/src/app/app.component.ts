import { Component, effect, inject, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { HeaderComponent } from './components/header/header.component';
import { NotificationService } from './services/notification.service';
import { SocketService } from './services/socket.service';
import { UserService } from './services/user.service';
import { LoginService } from './services/login.service';

type NotificationPayload = Record<string, unknown>;

const NOTIFICATION_EVENTS = [
  'upload-complete',
  'upload-error',
  'suggestion-created',
  'favorite-added',
  'favorite-deleted',
  'file-deleted',
] as const;

function formatMessage(event: string, payload: NotificationPayload): string {
  switch (event) {
    case 'upload-complete':
      return `File "${payload['originalName']}" uploaded successfully`;
    case 'upload-error':
      return `Upload failed`;
    case 'suggestion-created':
      return `${payload['count']} new ${payload['category']} suggestions ready`;
    case 'favorite-added':
      return `"${payload['title']}" added to favorites`;
    case 'favorite-deleted':
      return payload['title']
        ? `"${payload['title']}" removed from favorites`
        : `Favorite removed`;
    case 'file-deleted':
      return payload['originalName']
        ? `File "${payload['originalName']}" deleted`
        : `File deleted`;
    default:
      return event;
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnDestroy {
  readonly notification = inject(NotificationService);
  private readonly socketService = inject(SocketService);
  private readonly userService = inject(UserService);
  private readonly loginService = inject(LoginService);

  private readonly socketUnsub$ = new Subject<void>();

  constructor() {
    effect(() => {
      if (this.loginService.isLoggedIn()) {
        this.connectAndSubscribe();
      } else {
        this.disconnectAndCleanup();
      }
    });
  }

  ngOnDestroy(): void {
    this.disconnectAndCleanup();
  }

  private connectAndSubscribe(): void {
    const token = this.userService.accessToken;
    if (!token || this.socketService.connected) return;

    this.socketService.connect(token);

    NOTIFICATION_EVENTS.forEach((event) => {
      this.socketService
        .on<NotificationPayload>(event)
        .pipe(takeUntil(this.socketUnsub$))
        .subscribe((payload) =>
          this.notification.show(formatMessage(event, payload)),
        );
    });
  }

  private disconnectAndCleanup(): void {
    this.socketUnsub$.next();
    this.socketService.disconnect();
  }
}
