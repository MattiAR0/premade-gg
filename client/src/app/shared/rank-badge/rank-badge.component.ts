import { Component, Input } from '@angular/core';

const TIERS = [
  'iron', 'bronze', 'silver', 'gold', 'platinum',
  'diamond', 'ascendant', 'immortal', 'radiant',
];

@Component({
  selector: 'app-rank-badge',
  standalone: true,
  templateUrl: './rank-badge.component.html',
  styleUrl: './rank-badge.component.scss',
})
export class RankBadgeComponent {
  @Input({ required: true }) rank!: string;

  /** "Gold 2" → "gold"; cualquier valor desconocido cae en "unranked" */
  get tier(): string {
    const word = (this.rank ?? '').trim().split(/\s+/)[0].toLowerCase();
    return TIERS.includes(word) ? word : 'unranked';
  }
}
