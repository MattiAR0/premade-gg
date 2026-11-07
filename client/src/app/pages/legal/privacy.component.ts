import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalPage } from './legal-page';

/** Política de privacidad (RGPD arts. 13 y 14). BORRADOR pendiente de revisión por un abogado. */
@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './privacy.component.html',
  styleUrl: './legal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyComponent extends LegalPage {}
