import { Component, Input } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { KarmaBadgeComponent } from '../karma-badge/karma-badge.component';
import { RankBadgeComponent } from '../rank-badge/rank-badge.component';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-player-card',
  standalone: true,
  imports: [KarmaBadgeComponent, RankBadgeComponent, UpperCasePipe, RouterLink],
  templateUrl: './player-card.component.html',
  styleUrl: './player-card.component.scss',
})
export class PlayerCardComponent {
  @Input({ required: true }) player!: User;
}
