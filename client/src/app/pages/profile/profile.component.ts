import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UpperCasePipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { MessageService } from '../../services/message.service';
import { AgentIconsService } from '../../services/agent-icons.service';
import { User, DAYS_OF_WEEK, DAYS_LABELS } from '../../models/user.model';
import { Reputation, ReviewEligibility } from '../../models/reputation.model';
import { LfgPost } from '../../models/lfg-post.model';
import { RankBadgeComponent } from '../../shared/rank-badge/rank-badge.component';
import { KarmaBadgeComponent } from '../../shared/karma-badge/karma-badge.component';
import { LfgCardComponent } from '../../shared/lfg-card/lfg-card.component';
import { LabelPipe } from '../../shared/pipes/label.pipe';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    RouterLink, UpperCasePipe, DatePipe, FormsModule,
    RankBadgeComponent, KarmaBadgeComponent, LfgCardComponent,
    LabelPipe,
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

  // ── Review form state ──────────────────────────────
  eligibility: ReviewEligibility | null = null;
  showReviewForm = false;
  reviewRating = 0;
  reviewHoverRating = 0;
  reviewComment = '';
  reviewSubmitting = false;
  reviewError = '';
  reviewSuccess = '';

  readonly daysOfWeek = DAYS_OF_WEEK;
  readonly daysLabels = DAYS_LABELS;
  private readonly title = inject(Title);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly apiService: ApiService,
    readonly authService: AuthService,
    private readonly messageService: MessageService,
    private readonly cdr: ChangeDetectorRef,
    readonly agentIcons: AgentIconsService,
  ) {
    this.agentIcons.load();
  }

  /** Color de una puntuación entera (mismos umbrales que el karma) */
  ratingLevel(rating: number): 'high' | 'mid' | 'low' | 'none' {
    if (!rating) return 'none';
    if (rating >= 4) return 'high';
    if (rating >= 3) return 'mid';
    return 'low';
  }

  /** Puede enviar mensaje (logueado y no es su propio perfil) */
  get canMessage(): boolean {
    return this.authService.isAuthenticated() && !this.isOwnProfile;
  }

  /** Abre chat directo con este jugador */
  sendMessage(): void {
    if (!this.user) return;
    this.messageService.startDirectChat(this.user._id);
  }

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
    this.resetReviewForm();
    this.cdr.markForCheck();

    this.apiService.getUserById(id).subscribe({
      next: (user) => {
        this.user = user;
        this.title.setTitle(`${user.riotId} · Jugadores · PremadeGG`);
        this.loading = false;
        this.cdr.markForCheck();

        // Cargar reviews y posts en paralelo
        this.apiService.getReviews({ target: id }).subscribe({
          next: (reviews) => {
            this.reviews = reviews;
            this.cdr.markForCheck();
          },
        });

        this.apiService.getLfgPostsByAuthor(id).subscribe({
          next: (res) => {
            this.lfgPosts = res.data;
            this.cdr.markForCheck();
          },
        });

        // Comprobar elegibilidad de review (solo si está logueado y no es su propio perfil)
        if (this.authService.isAuthenticated() && !this.isOwnProfile) {
          this.apiService.checkReviewEligibility(id).subscribe({
            next: (elig) => {
              this.eligibility = elig;
              this.cdr.markForCheck();
            },
          });
        }
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No se pudo cargar el perfil';
        this.cdr.markForCheck();
      },
    });
  }

  // ── Review form helpers ─────────────────────────────

  toggleReviewForm(): void {
    this.showReviewForm = !this.showReviewForm;
    if (!this.showReviewForm) {
      this.resetReviewForm();
    }
  }

  setRating(star: number): void {
    this.reviewRating = star;
  }

  setHoverRating(star: number): void {
    this.reviewHoverRating = star;
  }

  submitReview(): void {
    if (!this.user || this.reviewRating === 0) return;

    this.reviewSubmitting = true;
    this.reviewError = '';
    this.reviewSuccess = '';
    this.cdr.markForCheck();

    this.apiService.createReview({
      target: this.user._id,
      rating: this.reviewRating,
      comment: this.reviewComment.trim() || undefined,
    }).subscribe({
      next: (review) => {
        this.reviews = [review, ...this.reviews];
        this.reviewSubmitting = false;
        this.reviewSuccess = 'Valoración publicada';
        this.showReviewForm = false;
        // Actualizar el karma mostrado
        if (this.user) {
          this.apiService.getUserById(this.user._id).subscribe({
            next: (u) => {
              this.user = u;
              this.cdr.markForCheck();
            },
          });
        }
        // Ya no puede dejar otra review
        if (this.eligibility) {
          this.eligibility = { ...this.eligibility, canReview: false, reason: 'already_reviewed', existingReview: review };
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.reviewSubmitting = false;
        this.reviewError = err.error?.message || 'No se pudo publicar la valoración';
        this.cdr.markForCheck();
      },
    });
  }

  deleteReview(reviewId: string): void {
    this.apiService.deleteReview(reviewId).subscribe({
      next: () => {
        this.reviews = this.reviews.filter((r) => r._id !== reviewId);
        // Refrescar karma
        if (this.user) {
          this.apiService.getUserById(this.user._id).subscribe({
            next: (u) => {
              this.user = u;
              this.cdr.markForCheck();
            },
          });
          // Refrescar elegibilidad
          this.apiService.checkReviewEligibility(this.user._id).subscribe({
            next: (elig) => {
              this.eligibility = elig;
              this.cdr.markForCheck();
            },
          });
        }
        this.cdr.markForCheck();
      },
    });
  }

  isOwnReview(review: Reputation): boolean {
    return this.authService.currentUser()?._id === review.author?._id;
  }

  private resetReviewForm(): void {
    this.showReviewForm = false;
    this.reviewRating = 0;
    this.reviewHoverRating = 0;
    this.reviewComment = '';
    this.reviewSubmitting = false;
    this.reviewError = '';
    this.reviewSuccess = '';
    this.eligibility = null;
  }
}
