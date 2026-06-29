import { Component, computed, DestroyRef, inject, signal, Signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LoginService } from '../../services/login.service';
import { LoginComponent } from '../login/login.component';
import { UserWithoutPassword } from '../../interfaces/user';
import { UserService } from '../../services/user.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NgIf, LoginComponent, RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  isLoginModalOpen = false;
  isLoggedIn: Signal<boolean>;
  userName = signal<string | null>(null);

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly authService: LoginService,
    private readonly userService: UserService,
    private readonly router: Router,
  ) {
    this.isLoggedIn = computed(() => this.authService.isLoggedIn());
  }

  openLoginModal() {
    this.isLoginModalOpen = true;
  }

  closeLoginModal() {
    this.isLoginModalOpen = false;
  }

  onLogin(user: UserWithoutPassword | undefined) {
    this.authService.setLoggedIn(user ? !!user : false);
    if (user) {
      this.userName.set(user.username);
    }
    this.closeLoginModal();
  }

  onLogout() {
    this.userService
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        complete: () => {
          this.authService.setLoggedIn(false);
          this.userName.set(null);
          this.router.navigate(['/']);
        },
        error: () => {
          // Even if logout call fails, clear local state
          this.authService.setLoggedIn(false);
          this.userName.set(null);
          this.router.navigate(['/']);
        },
      });
  }
}
