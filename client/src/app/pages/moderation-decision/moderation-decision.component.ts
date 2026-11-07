import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ModerationDecision, REPORT_REASON_LABEL, REPORT_TARGET_LABEL } from '../../models/report.model';

/**
 * La persona afectada ve la decisión motivada (qué se hizo, por qué y con qué contenido)
 * y puede recurrirla una vez (DSA, arts. 17 y 20).
 */
@Component({
  selector: 'app-moderation-decision',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './moderation-decision.component.html',
  styleUrl: '../moderation/moderation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModerationDecisionComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly reasonLabel = REPORT_REASON_LABEL;
  readonly targetLabel = REPORT_TARGET_LABEL;

  decision: ModerationDecision | null = null;
  loading = true;
  loadError = '';

  appealText = '';
  sending = false;
  appealError = '';
  appealSent = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.getModerationDecision(id).subscribe({
      next: (decision) => {
        this.decision = decision;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.loadError = err.error?.message || 'No se pudo cargar la decisión.';
        this.cdr.markForCheck();
      },
    });
  }

  get appealStatusText(): string {
    switch (this.decision?.appealStatus) {
      case 'pending':
        return 'Has recurrido esta decisión. Una persona de moderación la está revisando de nuevo.';
      case 'reversed':
        return 'Aceptamos tu recurso y revocamos la decisión.';
      case 'upheld':
        return 'Revisamos tu recurso y mantenemos la decisión.';
      default:
        return '';
    }
  }

  appeal(): void {
    if (!this.decision) return;
    if (this.appealText.trim().length < 10) {
      this.appealError = 'Explica por qué no estás de acuerdo (al menos 10 caracteres).';
      return;
    }
    this.sending = true;
    this.appealError = '';
    this.api.appealReport(this.decision._id, this.appealText.trim()).subscribe({
      next: (res) => {
        this.sending = false;
        this.appealSent = res.message;
        this.decision = { ...this.decision!, appealStatus: 'pending', canAppeal: false, appealText: this.appealText.trim() };
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.sending = false;
        this.appealError = err.error?.message || 'No se pudo enviar el recurso. Inténtalo de nuevo.';
        this.cdr.markForCheck();
      },
    });
  }
}
