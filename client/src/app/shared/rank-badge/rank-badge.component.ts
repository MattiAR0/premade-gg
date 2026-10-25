import { Component, Input } from '@angular/core';
import { LabelPipe } from '../pipes/label.pipe';

const TIERS = [
  'iron', 'bronze', 'silver', 'gold', 'platinum',
  'diamond', 'ascendant', 'immortal', 'radiant',
];

/**
 * Emblemas de rango de valorant-api.com (misma fuente que los iconos de agentes).
 * La URL es fija por episodio y nº de tier: no hace falta pedir la API.
 * Tier 0 = sin rango, 3 = Hierro 1 … 27 = Radiante.
 */
const ICON_BASE = 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04';

@Component({
  selector: 'app-rank-badge',
  standalone: true,
  imports: [LabelPipe],
  templateUrl: './rank-badge.component.html',
  styleUrl: './rank-badge.component.scss',
})
export class RankBadgeComponent {
  @Input({ required: true }) rank!: string;
  /** sm: filas compactas · md: tarjetas · lg: cabecera de perfil */
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  /** Muestra el nombre junto al emblema (cabeceras); por defecto solo el emblema con tooltip */
  @Input() showLabel = false;

  /** Si el emblema no carga, se vuelve a la pastilla de texto */
  iconFailed = false;

  /** "Gold 2" → "gold"; cualquier valor desconocido cae en "unranked" */
  get tier(): string {
    const word = (this.rank ?? '').trim().split(/\s+/)[0].toLowerCase();
    return TIERS.includes(word) ? word : 'unranked';
  }

  /**
   * La base de datos guarda solo el tier ("Gold"): sin división se usa la 1.
   * Si el valor trae división ("Gold 2"), se respeta.
   */
  get iconUrl(): string {
    const index = TIERS.indexOf(this.tier);
    if (index < 0) return `${ICON_BASE}/0/smallicon.png`;
    if (this.tier === 'radiant') return `${ICON_BASE}/27/smallicon.png`;
    const division = Number((this.rank ?? '').trim().split(/\s+/)[1]);
    const offset = division >= 1 && division <= 3 ? division - 1 : 0;
    return `${ICON_BASE}/${3 + index * 3 + offset}/smallicon.png`;
  }
}
