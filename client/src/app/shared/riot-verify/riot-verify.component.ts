import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { RiotChallenge } from '../../models/riot.model';
import { User } from '../../models/user.model';

/**
 * Verificación del Riot ID con la tarjeta de jugador (mientras no haya RSO).
 * Se pide equipar una tarjeta concreta y jugar una partida: solo el dueño de la cuenta
 * de Riot puede cambiarla. Lo comprueba la Edge Function riot-verify.
 *
 * Sin `riotId`, verifica el Riot ID propio (Ajustes de cuenta). Con `riotId` y `region`,
 * sirve para recuperar un Riot ID que tiene otra cuenta sin verificar (onboarding).
 */
@Component({
  selector: 'app-riot-verify',
  standalone: true,
  imports: [DatePipe, UpperCasePipe],
  templateUrl: './riot-verify.component.html',
  styleUrl: './riot-verify.component.scss',
})
export class RiotVerifyComponent implements OnInit {
  private readonly auth = inject(AuthService);

  /** Riot ID que se quiere recuperar (solo sin onboarding) */
  @Input() riotId?: string;
  @Input() region?: string;
  @Output() readonly verified = new EventEmitter<{ challenge: RiotChallenge; user?: User }>();

  readonly challenge = signal<RiotChallenge | null>(null);
  readonly loading = signal(false);
  readonly checking = signal(false);
  readonly error = signal('');
  readonly info = signal('');

  ngOnInit(): void {
    // Retoma el reto en curso (lo normal es volver después de jugar la partida)
    this.auth.getRiotChallenge().subscribe({
      next: ({ challenge }) => {
        if (!challenge) return;
        if (this.riotId && challenge.riotId.toLowerCase() !== this.riotId.toLowerCase()) return;
        this.challenge.set(challenge);
        // Superado antes de vincular (onboarding): se termina de vincular sin pedir nada más
        if (challenge.verified && this.riotId) this.verified.emit({ challenge });
      },
      error: () => undefined, // sin reto previo se empieza de cero
    });
  }

  cardImage(c: RiotChallenge): string {
    return `https://media.valorant-api.com/playercards/${c.card.id}/smallart.png`;
  }

  start(): void {
    this.error.set('');
    this.info.set('');
    this.loading.set(true);
    this.auth.startRiotChallenge(this.riotId, this.region).subscribe({
      next: ({ challenge }) => {
        this.loading.set(false);
        this.challenge.set(challenge);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'No se pudo empezar la verificación. Inténtalo de nuevo.');
      },
    });
  }

  check(): void {
    this.error.set('');
    this.info.set('');
    this.checking.set(true);
    this.auth.checkRiotChallenge().subscribe({
      next: (res) => {
        this.checking.set(false);
        this.challenge.set(res.challenge);
        if (res.result === 'verified') {
          this.verified.emit({ challenge: res.challenge, user: res.user });
        } else if (res.result === 'step1_done') {
          this.info.set(
            'Primer paso hecho. Vuelve a tu tarjeta de siempre, juega otra partida y comprueba de nuevo cuando termine.',
          );
        } else if (res.result === 'no_match') {
          this.info.set(
            'Todavía no vemos ninguna partida tuya empezada después de iniciar la verificación. Si acabas de terminarla, espera unos minutos y vuelve a comprobarlo.',
          );
        } else {
          this.info.set(
            res.challenge.mode === 'equip'
              ? `En tu última partida no llevabas la tarjeta ${res.challenge.card.name}. Equípala y juega otra.`
              : `En tu última partida seguías con la tarjeta ${res.challenge.card.name}. Equipa otra y juega otra partida.`,
          );
        }
      },
      error: (err) => {
        this.checking.set(false);
        if (err.error?.code === 'expired' || err.error?.code === 'no_challenge') this.challenge.set(null);
        this.error.set(err.error?.message || 'No se pudo comprobar. Inténtalo de nuevo en unos minutos.');
      },
    });
  }
}
