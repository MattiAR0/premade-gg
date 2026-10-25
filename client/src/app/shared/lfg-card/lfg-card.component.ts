import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RankBadgeComponent } from '../rank-badge/rank-badge.component';
import { KarmaBadgeComponent } from '../karma-badge/karma-badge.component';
import { LfgPost } from '../../models/lfg-post.model';
import { LabelPipe } from '../pipes/label.pipe';

@Component({
  selector: 'app-lfg-card',
  standalone: true,
  imports: [RankBadgeComponent, KarmaBadgeComponent, RouterLink, LabelPipe, DecimalPipe],
  templateUrl: './lfg-card.component.html',
  styleUrl: './lfg-card.component.scss',
})
export class LfgCardComponent {
  @Input({ required: true }) post!: LfgPost;
  /** false cuando el contexto ya dice que el grupo está abierto (filtro "Abiertos", home) */
  @Input() showStatus = true;

  /** Número de miembros aceptados */
  get acceptedCount(): number {
    return this.post.members?.filter((m) => m.status === 'accepted').length || 0;
  }

  /** Miembros aceptados (para mostrar avatares) */
  get acceptedMembers() {
    return this.post.members?.filter((m) => m.status === 'accepted') || [];
  }

  /** Región del autor formateada */
  get regionLabel(): string {
    const map: Record<string, string> = { eu: 'EU', na: 'NA', ap: 'AP', kr: 'KR' };
    return map[this.post.author?.region] || this.post.author?.region?.toUpperCase() || '—';
  }
}
