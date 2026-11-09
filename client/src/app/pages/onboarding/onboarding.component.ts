import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LabelPipe } from '../../shared/pipes/label.pipe';
import { RiotVerifyComponent } from '../../shared/riot-verify/riot-verify.component';

/**
 * Vinculación del Riot ID. Obligatoria para quien entra con Google/Discord
 * o no terminó el registro: sin rango ni rol no puede usar el LFG.
 */
@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule, LabelPipe, RiotVerifyComponent],
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

  /** Riot ID que tiene otra cuenta sin verificar: se puede recuperar verificándolo */
  claim: { riotId: string; region: string } | null = null;

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

  /** Casilla de términos, privacidad y edad mínima */
  acceptTerms = false;
  termsError = false;

  onSubmit(): void {
    this.errorMessage = '';
    if (!this.acceptTerms) {
      this.termsError = true;
      this.errorMessage = 'Para usar PremadeGG tienes que aceptar los términos de uso y tener 16 años o más.';
      return;
    }
    this.termsError = false;

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
        acceptTerms: this.acceptTerms,
      })
      .subscribe({
        next: () => this.router.navigateByUrl(this.returnUrl),
        error: (err) => {
          this.loading = false;
          this.errorMessage = err.error?.message || 'No se pudo vincular tu cuenta de Riot';
          this.claim = err.error?.code === 'riot_id_claimable'
            ? { riotId: `${this.gameName.trim()}#${this.tagLine.trim()}`, region: this.region }
            : null;
          this.cdr.markForCheck();
          // El aviso (y el reto para recuperar el Riot ID) está arriba del formulario
          setTimeout(() => document.querySelector('.c-auth-card__error')?.scrollIntoView({ block: 'center' }));
        },
      });
  }

  /** Reto superado: se vincula el Riot ID y se le quita a la otra cuenta */
  onClaimVerified(): void {
    this.errorMessage = '';
    this.claim = null;
    this.onSubmit();
  }

  logout(): void {
    this.authService.logout();
  }
}
