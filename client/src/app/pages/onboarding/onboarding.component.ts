import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LabelPipe } from '../../shared/pipes/label.pipe';

/**
 * Vinculación del Riot ID. Obligatoria para quien entra con Google/Discord
 * o no terminó el registro: sin rango ni rol no puede usar el LFG.
 */
@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule, LabelPipe],
  templateUrl: './onboarding.component.html',
  styleUrl: '../register/register.component.scss',
})
export class OnboardingComponent implements OnInit {
  gameName = '';
  tagLine = '';
  region = 'eu';
  role = '';
  schedule = '';

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
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  /** Ruta interna a la que volver (solo rutas relativas, evita open redirects) */
  private get returnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
    return url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/onboarding') ? url : '/';
  }

  /** Rellena el formulario con lo que el usuario escribió al registrarse */
  async ngOnInit(): Promise<void> {
    const pending = await this.authService.getPendingOnboardingData();
    if (pending.riotId?.includes('#')) {
      const idx = pending.riotId.lastIndexOf('#');
      this.gameName = pending.riotId.slice(0, idx);
      this.tagLine = pending.riotId.slice(idx + 1);
    }
    this.region = pending.region || this.region;
    this.role = pending.role || '';
    this.schedule = pending.schedule || '';
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.gameName.trim() || !this.tagLine.trim()) {
      this.errorMessage = 'Introduce tu nombre de juego y tag';
      return;
    }
    if (!this.role || !this.schedule) {
      this.errorMessage = 'Selecciona tu rol y horario de juego';
      return;
    }

    this.loading = true;
    this.authService
      .completeOnboarding({
        riotId: `${this.gameName.trim()}#${this.tagLine.trim()}`,
        region: this.region,
        role: this.role,
        schedule: this.schedule,
      })
      .subscribe({
        next: () => this.router.navigateByUrl(this.returnUrl),
        error: (err) => {
          this.loading = false;
          this.errorMessage = err.error?.message || 'No se pudo vincular tu cuenta de Riot';
          this.cdr.markForCheck();
        },
      });
  }

  logout(): void {
    this.authService.logout();
  }
}
