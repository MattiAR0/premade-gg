import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { OauthButtonsComponent } from '../../shared/oauth-buttons/oauth-buttons.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, OauthButtonsComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = '';
  loading = false;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  /** Ruta interna a la que volver tras el login (solo rutas relativas, evita open redirects) */
  get returnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
    return url.startsWith('/') && !url.startsWith('//') ? url : '/';
  }

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor completa todos los campos';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: (res) => {
        // Cuenta sin Riot ID vinculado (p. ej. registro a medias) → onboarding
        if (res.user && !res.user.onboarded) {
          this.router.navigate(['/onboarding'], { queryParams: { returnUrl: this.returnUrl } });
          return;
        }
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Error al iniciar sesión';
        this.cdr.markForCheck();
      },
    });
  }
}
