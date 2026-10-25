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
  /**
   * Nº de valoraciones en las que se basa el karma. Todas las cuentas empiezan con 5,
   * así que con 0 se muestra "Sin valoraciones" en vez de un 5,0 que no demuestra nada.
   * null/undefined = dato no disponible: se muestra el valor sin recuento.
   */
  @Input() count: number | null | undefined = undefined;
  /** sm: filas compactas · md: tarjetas · lg: cabecera de perfil */
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  get unrated(): boolean {
    return this.count === 0;
  }

  get level(): 'high' | 'mid' | 'low' | 'none' {
    if (this.unrated) return 'none';
    if (this.karma >= 3.5) return 'high';
    if (this.karma >= 2.5) return 'mid';
    return 'low';
  }

  /** Relleno (0–1) de cada uno de los 5 segmentos */
  get segments(): number[] {
    const value = this.unrated ? 0 : Math.min(Math.max(this.karma ?? 0, 0), KARMA_MAX);
    return Array.from({ length: KARMA_MAX }, (_, i) => Math.min(Math.max(value - i, 0), 1));
  }

  get countLabel(): string {
    if (this.count == null) return '';
    return this.count === 1 ? '1 valoración' : `${this.count} valoraciones`;
  }

  get ariaLabel(): string {
    if (this.unrated) return 'Karma: sin valoraciones todavía';
    const value = `Karma ${(this.karma ?? 0).toFixed(1).replace('.', ',')} de ${KARMA_MAX}`;
    return this.count ? `${value}, ${this.countLabel}` : value;
  }
}
