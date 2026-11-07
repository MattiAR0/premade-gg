import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalPage } from './legal-page';

/** Aviso legal (LSSI-CE art. 10). BORRADOR pendiente de revisión por un abogado. */
@Component({
  selector: 'app-legal-notice',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './legal-notice.component.html',
  styleUrl: './legal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalNoticeComponent extends LegalPage {}
