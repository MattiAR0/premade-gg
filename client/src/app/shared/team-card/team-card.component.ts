import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RankBadgeComponent } from '../rank-badge/rank-badge.component';
import { Team } from '../../models/team.model';

@Component({
  selector: 'app-team-card',
  standalone: true,
  imports: [RankBadgeComponent, RouterLink],
  templateUrl: './team-card.component.html',
  styleUrl: './team-card.component.scss',
})
export class TeamCardComponent {
  @Input({ required: true }) team!: Team;

  get regionLabel(): string {
    const map: Record<string, string> = { eu: 'EU', na: 'NA', ap: 'AP', kr: 'KR' };
    return map[this.team.region] || this.team.region?.toUpperCase() || '—';
  }

  get playerCount(): number {
    return this.team.players?.length || 0;
  }

  get initials(): string {
    return this.team.tag?.substring(0, 3) || this.team.name?.charAt(0) || '?';
  }

  get hasCoach(): boolean {
    return !!this.team.coach;
  }

  get truncatedDescription(): string {
    if (!this.team.description) return '';
    return this.team.description.length > 100
      ? this.team.description.substring(0, 100) + '...'
      : this.team.description;
  }
}
