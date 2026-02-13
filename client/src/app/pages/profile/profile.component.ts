import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UpperCasePipe, DatePipe } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { User, DAYS_OF_WEEK, DAYS_LABELS } from '../../models/user.model';
import { Reputation } from '../../models/reputation.model';
import { LfgPost } from '../../models/lfg-post.model';
import { RankBadgeComponent } from '../../shared/rank-badge/rank-badge.component';
import { KarmaBadgeComponent } from '../../shared/karma-badge/karma-badge.component';
import { LfgCardComponent } from '../../shared/lfg-card/lfg-card.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    RouterLink, UpperCasePipe, DatePipe,
    RankBadgeComponent, KarmaBadgeComponent, LfgCardComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  user: User | null = null;
  reviews: Reputation[] = [];
  lfgPosts: LfgPost[] = [];
  loading = true;
  errorMessage = '';

  readonly daysOfWeek = DAYS_OF_WEEK;
  readonly daysLabels = DAYS_LABELS;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly apiService: ApiService,
    readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.loadProfile(params['id']);
    });
  }

  /** ¿Es el perfil del usuario logueado? */
  get isOwnProfile(): boolean {
    return this.authService.isAuthenticated() &&
      this.authService.currentUser()?._id === this.user?._id;
  }

  /** Obtiene la URL de la imagen de perfil */
  get profileImageUrl(): string | null {
    if (!this.user) return null;
    if (this.user.profileImageType === 'riot_card' && this.user.cardImage) {
      return this.user.cardImage;
    }
    return this.user.profileImage;
  }

  /** Obtiene la letra inicial para el placeholder */
  get initial(): string {
    return this.user?.riotId?.charAt(0)?.toUpperCase() || '?';
  }

  /** Verifica si el usuario tiene disponibilidad configurada */
  get hasAvailability(): boolean {
    if (!this.user?.availability) return false;
    return Object.values(this.user.availability).some((v) => v.available);
  }

  /** Verifica si el usuario tiene enlaces sociales */
  get hasSocialLinks(): boolean {
    if (!this.user?.socialLinks) return false;
    const links = this.user.socialLinks;
    return !!(links.discord || links.twitter || links.twitch);
  }

  private loadProfile(id: string): void {
    this.loading = true;
    this.errorMessage = '';

    this.apiService.getUserById(id).subscribe({
      next: (user) => {
        this.user = user;
        this.loading = false;

        // Cargar reviews y posts en paralelo
        this.apiService.getReviews({ target: id }).subscribe({
          next: (reviews) => this.reviews = reviews,
        });

        this.apiService.getLfgPostsByAuthor(id).subscribe({
          next: (res) => this.lfgPosts = res.data,
        });
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No se pudo cargar el perfil';
      },
    });
  }
}
