import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

const KARMA_MAX = 5;

@Component({
  selector: 'app-karma-badge',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './karma-badge.component.html',
  styleUrl: './karma-badge.component.scss',
})
export class KarmaBadgeComponent {
  @Input({ required: true }) karma!: number;
  /** sm: filas compactas · md: tarjetas · lg: cabecera de perfil */
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  get level(): 'high' | 'mid' | 'low' {
    if (this.karma >= 3.5) return 'high';
    if (this.karma >= 2.5) return 'mid';
    return 'low';
  }

  /** Relleno (0–1) de cada uno de los 5 segmentos */
  get segments(): number[] {
    const value = Math.min(Math.max(this.karma ?? 0, 0), KARMA_MAX);
    return Array.from({ length: KARMA_MAX }, (_, i) => Math.min(Math.max(value - i, 0), 1));
  }

  get ariaLabel(): string {
    return `Karma ${(this.karma ?? 0).toFixed(1).replace('.', ',')} de ${KARMA_MAX}`;
  }
}
