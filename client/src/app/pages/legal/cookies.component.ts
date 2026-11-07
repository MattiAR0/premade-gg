import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalPage } from './legal-page';

/**
 * Política de cookies y almacenamiento local (LSSI-CE art. 22.2). Hoy solo hay almacenamiento técnico,
 * que no necesita consentimiento. Si se añade analítica o publicidad, hará falta un banner con consentimiento previo.
 */
@Component({
  selector: 'app-cookies',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cookies.component.html',
  styleUrl: './legal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CookiesComponent extends LegalPage {}
