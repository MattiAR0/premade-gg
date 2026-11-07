import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import {
  REPORT_REASON_LABEL,
  REPORT_TARGET_LABEL,
  Report,
  ReportAction,
} from '../../models/report.model';

type Queue = 'open' | 'appeals' | 'resolved';

interface DraftDecision {
  note: string;
  removeContent: boolean;
  suspendDays: number | null;
  busy: boolean;
  error: string;
}

/**
 * Cola de moderación: denuncias abiertas, recursos y lo resuelto.
 * Cada decisión lleva un motivo que reciben el denunciante y el afectado (DSA, art. 17).
 */
@Component({
  selector: 'app-moderation',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './moderation.component.html',
  styleUrl: './moderation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModerationComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly reasonLabel = REPORT_REASON_LABEL;
  readonly targetLabel = REPORT_TARGET_LABEL;
  readonly queues: { value: Queue; label: string }[] = [
    { value: 'open', label: 'Denuncias abiertas' },
    { value: 'appeals', label: 'Recursos' },
    { value: 'resolved', label: 'Resueltas' },
  ];
  readonly suspendOptions: { value: number | null; label: string }[] = [
    { value: null, label: 'No suspender' },
    { value: 1, label: '1 día' },
    { value: 7, label: '7 días' },
    { value: 30, label: '30 días' },
    { value: 90, label: '90 días' },
    { value: 365, label: '1 año' },
  ];

  queue: Queue = 'open';
  reports: Report[] = [];
  loading = true;
  loadError = '';
  notice = '';
  drafts: Record<string, DraftDecision> = {};

  ngOnInit(): void {
    this.load();
  }

  setQueue(queue: Queue): void {
    this.queue = queue;
    this.notice = '';
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadError = '';
    this.api.getReports(this.queue).subscribe({
      next: (reports) => {
        this.reports = reports;
        this.drafts = {};
        for (const r of reports) {
          this.drafts[r._id] = { note: '', removeContent: false, suspendDays: null, busy: false, error: '' };
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.loadError = err.error?.message || 'No se pudo cargar la cola. Inténtalo de nuevo.';
        this.cdr.markForCheck();
      },
    });
  }

  /** Dónde ver el contenido denunciado (si sigue existiendo y tiene página) */
  contentLink(report: Report): string[] | null {
    switch (report.targetType) {
      case 'profile':
        return ['/profile', report.targetId];
      case 'team':
        return ['/teams', report.targetId];
      case 'lfg_post':
        return ['/lfg', report.targetId];
      default:
        return report.targetUser ? ['/profile', report.targetUser._id] : null;
    }
  }

  actionText(action: ReportAction | null, until: string | null): string {
    const date = until ? new Date(until).toLocaleDateString('es-ES') : '';
    switch (action) {
      case 'content_removed':
        return 'Contenido retirado';
      case 'user_suspended':
        return `Cuenta suspendida hasta el ${date}`;
      case 'content_removed_user_suspended':
        return `Contenido retirado y cuenta suspendida hasta el ${date}`;
      default:
        return 'Desestimada, sin medidas';
    }
  }

  /** Desestimar (sin medidas) o aplicar las medidas marcadas */
  resolve(report: Report, dismiss: boolean): void {
    const draft = this.drafts[report._id];
    if (!dismiss && !draft.removeContent && draft.suspendDays === null) {
      draft.error = 'Marca al menos una medida, o desestima la denuncia.';
      return;
    }
    if (draft.note.trim().length < 10) {
      draft.error = 'Explica el motivo (al menos 10 caracteres): lo recibirán el denunciante y el afectado.';
      return;
    }
    draft.busy = true;
    draft.error = '';
    this.api
      .resolveReport(report._id, dismiss ? false : draft.removeContent, dismiss ? null : draft.suspendDays, draft.note.trim())
      .subscribe({
        next: () => this.done(report, dismiss ? 'Denuncia desestimada.' : 'Medidas aplicadas y partes avisadas.'),
        error: (err) => this.fail(draft, err),
      });
  }

  /** Mantener o revocar la decisión recurrida */
  resolveAppeal(report: Report, reverse: boolean): void {
    const draft = this.drafts[report._id];
    if (draft.note.trim().length < 10) {
      draft.error = 'Explica el motivo (al menos 10 caracteres): lo recibirá el afectado.';
      return;
    }
    draft.busy = true;
    draft.error = '';
    this.api.resolveAppeal(report._id, reverse, draft.note.trim()).subscribe({
      next: () => this.done(report, reverse ? 'Decisión revocada.' : 'Decisión mantenida.'),
      error: (err) => this.fail(draft, err),
    });
  }

  private done(report: Report, message: string): void {
    this.reports = this.reports.filter((r) => r._id !== report._id);
    this.notice = message;
    this.cdr.markForCheck();
  }

  private fail(draft: DraftDecision, err: { error?: { message?: string } }): void {
    draft.busy = false;
    draft.error = err.error?.message || 'No se pudo guardar la decisión. Inténtalo de nuevo.';
    this.cdr.markForCheck();
  }
}
