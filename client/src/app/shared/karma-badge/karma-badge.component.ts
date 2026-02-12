import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-karma-badge',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './karma-badge.component.html',
  styleUrl: './karma-badge.component.scss',
})
export class KarmaBadgeComponent {
  @Input({ required: true }) karma!: number;

  get karmaClass(): string {
    if (this.karma >= 3.5) return 'c-badge--karma-high';
    if (this.karma >= 2.5) return 'c-badge--karma-mid';
    return 'c-badge--karma-low';
  }
}
