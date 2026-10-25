import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { OauthButtonsComponent } from '../../shared/oauth-buttons/oauth-buttons.component';
import { LabelPipe } from '../../shared/pipes/label.pipe';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, OauthButtonsComponent, LabelPipe],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  // Form fields
  email = '';
  password = '';
  confirmPassword = '';
  gameName = '';
  tagLine = '';
  region = 'eu';
  role = '';
  // Por defecto: se cambia después en el perfil (un campo menos en el registro)
  schedule = 'Flexible';

  // Validation state
  riotValidated = false;
  riotValidating = false;
  riotError = '';
  validatedRank = '';

  // General state
  errorMessage = '';
  loading = false;
  /** El proyecto exige confirmar el email: se muestra el aviso en lugar del formulario */
  confirmationSent = false;

  readonly regions = [
    { value: 'eu', label: 'Europa' },
    { value: 'na', label: 'Norteamérica' },
    { value: 'ap', label: 'Asia Pacífico' },
    { value: 'kr', label: 'Corea' },
  ];

  readonly roles = ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'];

  constructor(
    private readonly authService: AuthService,
    private readonly apiService: ApiService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
  ) { }

  /** Ruta interna a la que volver tras registrarse (solo rutas relativas, evita open redirects) */
  private get returnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
    return url.startsWith('/') && !url.startsWith('//') ? url : '/';
  }

  /** Resetea la validación cuando cambian los campos de Riot */
  onRiotFieldChange(): void {
    // Ya no se usa para limpiar la validación manual, pero se deja
    // por si acaso es útil para otra cosa o se remueve si se prefiere.
    this.errorMessage = '';
  }

  onSubmit(): void {
    this.errorMessage = '';

    // Validaciones
    if (!this.email || !this.password || !this.confirmPassword) {
      this.errorMessage = 'Por favor completa todos los campos obligatorios';
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'La contraseña debe tener al menos 6 caracteres';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden';
      return;
    }

    if (!this.gameName || !this.tagLine) {
      this.errorMessage = 'Introduce tu nombre de juego y tag';
      return;
    }

    if (!this.role) {
      this.errorMessage = 'Selecciona tu rol principal';
      return;
    }

    this.loading = true;

    // Validar Riot ID automáticamente antes de registrar
    this.apiService.validateRiotId(this.gameName, this.tagLine).subscribe({
      next: (res) => {
        if (res.taken) {
          this.loading = false;
          this.errorMessage = 'Este Riot ID ya está registrado';
          this.cdr.markForCheck();
          return;
        }
        this.finishRegistration();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'No se pudo validar la cuenta de Riot';
        this.cdr.markForCheck();
      },
    });
  }

  private finishRegistration(): void {
    this.authService.register({
      email: this.email,
      password: this.password,
      riotId: `${this.gameName}#${this.tagLine}`,
      region: this.region,
      role: this.role,
      schedule: this.schedule,
    }).subscribe({
      next: (res) => {
        if (res.emailConfirmationRequired) {
          this.loading = false;
          this.confirmationSent = true;
          this.cdr.markForCheck();
          return;
        }
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (err) => {
        // Cuenta creada pero no se pudo vincular el Riot ID: se termina en /onboarding
        if (err.onboardingRequired) {
          this.router.navigate(['/onboarding'], { queryParams: { returnUrl: this.returnUrl } });
          return;
        }
        this.loading = false;
        this.errorMessage = err.error?.message || 'Error al registrarse';
        this.cdr.markForCheck();
      },
    });
  }
}
