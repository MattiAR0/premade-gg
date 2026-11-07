import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DialogDirective } from '../dialog/dialog.directive';
import { REPORT_REASONS, REPORT_TARGET_LABEL, ReportReason, ReportTarget } from '../../models/report.model';

let nextId = 0;

/**
 * Botón "Denunciar" con su diálogo (motivo + detalles). Solo se muestra con sesión.
 * Lo usan el perfil, las valoraciones, los mensajes, los equipos y los grupos LFG.
 */
@Component({
  selector: 'app-report-button',
  standalone: true,
  imports: [FormsModule, DialogDirective],
  templateUrl: './report-button.component.html',
  styleUrl: './report-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportButtonComponent {
  @Input({ required: true }) targetType!: ReportTarget;
  @Input({ required: true }) targetId!: string;
  /** Qué se denuncia, para el título del diálogo (p. ej. el Riot ID) */
  @Input() targetLabel = '';
  /** button: botón con texto · link: enlace pequeño (dentro de tarjetas y mensajes) */
  @Input() variant: 'button' | 'link' = 'button';

  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly reasons = REPORT_REASONS;
  readonly uid = `report-${++nextId}`;

  open = false;
  reason: ReportReason | '' = '';
  details = '';
  sending = false;
  error = '';
  done = '';

  get title(): string {
    const what = REPORT_TARGET_LABEL[this.targetType].toLowerCase();
    return this.targetLabel ? `Denunciar ${what} de ${this.targetLabel}` : `Denunciar ${what}`;
  }

  openDialog(): void {
    this.open = true;
    this.reason = '';
    this.details = '';
    this.error = '';
    this.done = '';
  }

  close(): void {
    this.open = false;
  }

  submit(): void {
    if (!this.reason) {
      this.error = 'Elige el motivo de la denuncia.';
      return;
    }
    this.sending = true;
    this.error = '';
    this.api.createReport(this.targetType, this.targetId, this.reason, this.details.trim()).subscribe({
      next: (res) => {
        this.sending = false;
        this.done = res.message;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.sending = false;
        this.error = err.error?.message || 'No se pudo enviar la denuncia. Inténtalo de nuevo.';
        this.cdr.markForCheck();
      },
    });
  }
}
