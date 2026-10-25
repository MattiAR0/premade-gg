import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { AuthService, OAuthProvider } from '../../services/auth.service';

/** Botones "Continuar con Google / Discord" para login y registro. */
@Component({
  selector: 'app-oauth-buttons',
  standalone: true,
  templateUrl: './oauth-buttons.component.html',
  styleUrl: './oauth-buttons.component.scss',
})
export class OauthButtonsComponent {
  /** Ruta interna a la que volver tras el login */
  @Input() returnUrl = '/';

  loadingProvider: OAuthProvider | null = null;
  errorMessage = '';

  constructor(
    private readonly authService: AuthService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async signIn(provider: OAuthProvider): Promise<void> {
    this.loadingProvider = provider;
    this.errorMessage = '';
    try {
      await this.authService.loginWithProvider(provider, this.returnUrl);
      // El navegador redirige al proveedor; no hay nada más que hacer aquí
    } catch (err) {
      this.loadingProvider = null;
      this.errorMessage = (err as { error?: { message?: string } }).error?.message || 'No se pudo iniciar sesión';
      this.cdr.markForCheck();
    }
  }
}
