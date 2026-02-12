import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-rank-badge',
  standalone: true,
  templateUrl: './rank-badge.component.html',
  styleUrl: './rank-badge.component.scss',
})
export class RankBadgeComponent {
  @Input({ required: true }) rank!: string;
}
