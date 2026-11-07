import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalPage } from './legal-page';

/** Términos de uso y normas de la comunidad (DSA art. 14). BORRADOR pendiente de revisión por un abogado. */
@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './terms.component.html',
  styleUrl: './legal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsComponent extends LegalPage {}
