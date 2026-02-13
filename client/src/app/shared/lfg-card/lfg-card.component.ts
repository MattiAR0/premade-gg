import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { KarmaBadgeComponent } from '../karma-badge/karma-badge.component';
import { RankBadgeComponent } from '../rank-badge/rank-badge.component';
import { LfgPost } from '../../models/lfg-post.model';

@Component({
  selector: 'app-lfg-card',
  standalone: true,
  imports: [KarmaBadgeComponent, RankBadgeComponent, RouterLink],
  templateUrl: './lfg-card.component.html',
  styleUrl: './lfg-card.component.scss',
})
export class LfgCardComponent {
  @Input({ required: true }) post!: LfgPost;
}
