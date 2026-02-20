import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { RankBadgeComponent } from '../../shared/rank-badge/rank-badge.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, RankBadgeComponent],
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
  schedule = '';

  // Validation state
  riotValidated = false;
  riotValidating = false;
  riotError = '';
  validatedRank = '';

  // General state
  errorMessage = '';
  loading = false;

  readonly regions = [
    { value: 'eu', label: 'Europa' },
    { value: 'na', label: 'Norteamérica' },
    { value: 'ap', label: 'Asia Pacífico' },
    { value: 'kr', label: 'Corea' },
  ];

  readonly roles = ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'];
  readonly schedules = ['Weekends', 'Evenings', 'Late Night', 'Mornings', 'Flexible'];

  constructor(
    private readonly authService: AuthService,
    private readonly apiService: ApiService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

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

    if (!this.role || !this.schedule) {
      this.errorMessage = 'Selecciona tu rol y horario de juego';
      return;
    }

    this.loading = true;

    // Validar Riot ID automáticamente antes de registrar
    this.apiService.validateRiotId(this.gameName, this.tagLine).subscribe({
      next: () => {
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
      next: () => {
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Error al registrarse';
        this.cdr.markForCheck();
      },
    });
  }
}
