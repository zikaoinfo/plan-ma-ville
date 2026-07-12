import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly annee = new Date().getFullYear();
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((o) => !o);
  }

  protected loginGoogle(): void {
    void this.auth.loginWithGoogle();
  }

  protected async logout(): Promise<void> {
    this.menuOpen.set(false);
    await this.auth.logout();
  }
}
