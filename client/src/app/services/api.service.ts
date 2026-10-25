import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { User } from '../models/user.model';
import { Reputation, ReviewEligibility } from '../models/reputation.model';
import { LfgPost } from '../models/lfg-post.model';
import { Team } from '../models/team.model';
import { RiotAccountValidation, RiotRankData } from '../models/riot.model';
import { AppNotification } from '../models/notification.model';
import { invokeFunction, rpc } from './supabase.client';

/** Respuesta paginada genérica (cursor-based) */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  totalPages: number;
  nextCursor: string | null;
}

type Message = { message: string };

// ── Cache en memoria con TTL ────────────────────────────
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60_000; // 1 minuto

/**
 * Acceso a datos de PremadeGG.
 * Las lecturas y escrituras van a funciones RPC de Postgres (supabase/migrations)
 * que devuelven la misma forma que la antigua API Express; la integración con Riot
 * va a Edge Functions (supabase/functions).
 */
@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  private cachedRpc<T>(fn: string, args: Record<string, unknown> = {}, ttl = DEFAULT_TTL_MS): Observable<T> {
    const key = `${fn}?${JSON.stringify(args)}`;
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (entry && Date.now() < entry.expiresAt) {
      return of(entry.data);
    }

    return rpc<T>(fn, args).pipe(
      tap((data) => {
        this.cache.set(key, { data, expiresAt: Date.now() + ttl });
      }),
    );
  }

  /** Invalida todo el cache */
  clearCache(): void {
    this.cache.clear();
  }

  /** Invalida entradas de cache cuyo nombre de función empiece por el prefijo */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  // ── Riot API (Edge Functions) ───────────────────────
  validateRiotId(gameName: string, tagLine: string): Observable<RiotAccountValidation> {
    return invokeFunction<RiotAccountValidation>('riot-validate', { gameName, tagLine });
  }

  getRiotRank(region: string, gameName: string, tagLine: string): Observable<RiotRankData> {
    return invokeFunction<{ rank: RiotRankData }>('riot-validate', { gameName, tagLine, region }).pipe(
      map((res) => res.rank),
    );
  }

  // ── Users ───────────────────────────────────────────
  getUsers(filters?: {
    rank?: string;
    role?: string;
    minKarma?: number;
    lookingForTeam?: boolean;
    minReviews?: number;
    cursor?: string;
    limit?: number;
  }): Observable<PaginatedResponse<User>> {
    return this.cachedRpc<PaginatedResponse<User>>('get_users', {
      p_rank: filters?.rank || null,
      p_role: filters?.role || null,
      p_min_karma: filters?.minKarma || null,
      p_looking_for_team: filters?.lookingForTeam || null,
      p_cursor: filters?.cursor || null,
      p_limit: filters?.limit || 12,
      // Solo se envía si se usa: así el RPC antiguo (sin el parámetro) sigue funcionando
      ...(filters?.minReviews ? { p_min_reviews: filters.minReviews } : {}),
    });
  }

  getUserById(id: string): Observable<User> {
    return this.cachedRpc<User | null>('get_user', { p_id: id }).pipe(
      map((user) => {
        if (!user) throw { status: 404, error: { message: 'Usuario no encontrado' } };
        return user;
      }),
    );
  }

  // ── Reviews ─────────────────────────────────────────
  getReviews(filters?: { target?: string; author?: string }): Observable<Reputation[]> {
    return this.cachedRpc<Reputation[]>('get_reviews', {
      p_target: filters?.target || null,
      p_author: filters?.author || null,
    });
  }

  createReview(data: { target: string; rating: number; comment?: string }): Observable<Reputation> {
    return rpc<Reputation>('create_review', {
      p_target: data.target,
      p_rating: data.rating,
      p_comment: data.comment ?? null,
    }).pipe(tap(() => this.invalidateReputation()));
  }

  deleteReview(id: string): Observable<Message> {
    return rpc<Message>('delete_review', { p_id: id }).pipe(tap(() => this.invalidateReputation()));
  }

  /** Una review cambia el karma: invalida reviews y usuarios */
  private invalidateReputation(): void {
    this.invalidateByPrefix('get_reviews');
    this.invalidateByPrefix('get_user');
  }

  checkReviewEligibility(targetId: string): Observable<ReviewEligibility> {
    return rpc<ReviewEligibility>('get_review_eligibility', { p_target: targetId });
  }

  // ── LFG Posts ───────────────────────────────────────
  getLfgPosts(filters?: {
    teamSize?: number;
    status?: string;
    /** Solo grupos a los que se puede entrar con este rango */
    myRank?: string;
    /** Karma mínimo del creador */
    minAuthorKarma?: number;
    cursor?: string;
    limit?: number;
  }): Observable<PaginatedResponse<LfgPost>> {
    return this.cachedRpc<PaginatedResponse<LfgPost>>('get_lfg_posts', {
      p_team_size: filters?.teamSize || null,
      p_status: filters?.status || null,
      p_cursor: filters?.cursor || null,
      p_limit: filters?.limit || 12,
      ...(filters?.myRank ? { p_my_rank: filters.myRank } : {}),
      ...(filters?.minAuthorKarma ? { p_min_author_karma: filters.minAuthorKarma } : {}),
    });
  }

  getLfgPostById(id: string): Observable<LfgPost> {
    return rpc<LfgPost | null>('get_lfg_post', { p_id: id }).pipe(
      map((post) => {
        if (!post) throw { status: 404, error: { message: 'Post LFG no encontrado' } };
        return post;
      }),
    );
  }

  createLfgPost(data: {
    title: string;
    description?: string;
    teamSize: number;
    minRank?: string;
    minKarma?: number;
    initialMembers?: string[];
  }): Observable<LfgPost> {
    return rpc<LfgPost>('create_lfg_post', {
      p_title: data.title,
      p_team_size: data.teamSize,
      p_description: data.description ?? null,
      p_min_rank: data.minRank || null,
      p_min_karma: data.minKarma ?? 3,
      p_initial_members: data.initialMembers ?? [],
    }).pipe(tap(() => this.invalidateByPrefix('get_lfg_posts')));
  }

  // ── LFG Miembros ────────────────────────────────────
  joinLfgPost(postId: string): Observable<Message> {
    return rpc<Message>('join_lfg_post', { p_id: postId }).pipe(tap(() => this.invalidateByPrefix('get_lfg_posts')));
  }

  handleLfgMember(postId: string, userId: string, action: 'accept' | 'reject'): Observable<{ message: string; post?: LfgPost }> {
    return rpc<{ message: string; post?: LfgPost }>('handle_lfg_member', {
      p_post_id: postId,
      p_user_id: userId,
      p_action: action,
    }).pipe(tap(() => this.invalidateByPrefix('get_lfg_posts')));
  }

  /** Solo el creador. status: 'closed' cierra; 'open' reabre (queda 'full' si ya está completo) */
  updateLfgPost(
    postId: string,
    data: { title?: string; description?: string; minRank?: string; minKarma?: number; status?: 'open' | 'closed' },
  ): Observable<LfgPost> {
    return rpc<LfgPost>('update_lfg_post', { p_id: postId, p_data: data }).pipe(
      tap(() => this.invalidateByPrefix('get_lfg_posts')),
    );
  }

  deleteLfgPost(postId: string): Observable<Message> {
    return rpc<Message>('delete_lfg_post', { p_id: postId }).pipe(tap(() => this.invalidateByPrefix('get_lfg_posts')));
  }

  leaveLfgPost(postId: string, userId: string): Observable<Message> {
    return rpc<Message>('leave_lfg_post', { p_post_id: postId, p_user_id: userId }).pipe(
      tap(() => this.invalidateByPrefix('get_lfg_posts')),
    );
  }

  // ── LFG Posts by author ────────────────────────────
  getLfgPostsByAuthor(authorId: string): Observable<PaginatedResponse<LfgPost>> {
    return this.cachedRpc<PaginatedResponse<LfgPost>>('get_lfg_posts', { p_author: authorId });
  }

  // ── User Search (autocomplete) ─────────────
  searchUsers(query: string): Observable<User[]> {
    return rpc<User[]>('search_users', { p_q: query });
  }

  // ── Teams ───────────────────────────────────────────
  getTeams(filters?: Record<string, string | number | boolean>): Observable<PaginatedResponse<Team>> {
    const f = filters ?? {};
    return this.cachedRpc<PaginatedResponse<Team>>('get_teams', {
      p_region: f['region'] || null,
      p_target_rank: f['targetRank'] || null,
      p_recruiting: f['recruiting'] === true || f['recruiting'] === 'true' ? true : null,
      p_search: f['search'] || null,
      p_cursor: f['cursor'] || null,
      p_limit: Number(f['limit']) || 12,
    });
  }

  getTeamById(id: string): Observable<Team> {
    return rpc<Team | null>('get_team', { p_id: id }).pipe(
      map((team) => {
        if (!team) throw { status: 404, error: { message: 'Equipo no encontrado' } };
        return team;
      }),
    );
  }

  createTeam(data: Partial<Team> & { initialPlayers?: string[] }): Observable<Team> {
    return rpc<Team>('create_team', { p_data: data }).pipe(tap(() => this.invalidateByPrefix('get_teams')));
  }

  updateTeam(id: string, data: Partial<Team>): Observable<Team> {
    return rpc<Team>('update_team', { p_id: id, p_data: data }).pipe(tap(() => this.invalidateByPrefix('get_teams')));
  }

  deleteTeam(id: string): Observable<Message> {
    return rpc<Message>('delete_team', { p_id: id }).pipe(tap(() => this.invalidateByPrefix('get_teams')));
  }

  setTeamCoach(teamId: string, userId: string | null): Observable<Message> {
    return rpc<Message>('set_team_coach', { p_team_id: teamId, p_user_id: userId }).pipe(
      tap(() => this.invalidateByPrefix('get_teams')),
    );
  }

  addTeamPlayer(teamId: string, userId: string, role: string): Observable<Message> {
    return rpc<Message>('add_team_player', { p_team_id: teamId, p_user_id: userId, p_role: role }).pipe(
      tap(() => this.invalidateByPrefix('get_teams')),
    );
  }

  removeTeamPlayer(teamId: string, userId: string): Observable<Message> {
    return rpc<Message>('remove_team_player', { p_team_id: teamId, p_user_id: userId }).pipe(
      tap(() => this.invalidateByPrefix('get_teams')),
    );
  }

  addTeamStaff(teamId: string, userId: string, role: string): Observable<Message> {
    return rpc<Message>('add_team_staff', { p_team_id: teamId, p_user_id: userId, p_role: role }).pipe(
      tap(() => this.invalidateByPrefix('get_teams')),
    );
  }

  removeTeamStaff(teamId: string, userId: string): Observable<Message> {
    return rpc<Message>('remove_team_staff', { p_team_id: teamId, p_user_id: userId }).pipe(
      tap(() => this.invalidateByPrefix('get_teams')),
    );
  }

  // ── Team Join Requests ────────────────────────────────

  requestJoinTeam(teamId: string, message: string): Observable<Message> {
    return rpc<Message>('request_join_team', { p_team_id: teamId, p_message: message });
  }

  reviewJoinRequestTeam(teamId: string, userId: string, status: 'accepted' | 'rejected'): Observable<Message> {
    return rpc<Message>('review_team_join_request', { p_team_id: teamId, p_user_id: userId, p_status: status }).pipe(
      tap(() => this.invalidateByPrefix('get_teams')),
    );
  }

  // ── Notifications ───────────────────────────────────
  getNotifications(unreadOnly = false): Observable<AppNotification[]> {
    return rpc<AppNotification[]>('get_notifications', { p_unread_only: unreadOnly });
  }

  getUnreadNotificationCount(): Observable<{ count: number }> {
    return rpc<number>('get_unread_notification_count').pipe(map((count) => ({ count })));
  }

  markNotificationAsRead(id: string): Observable<Message> {
    return rpc<Message>('mark_notification_read', { p_id: id });
  }

  markAllNotificationsAsRead(): Observable<Message> {
    return rpc<Message>('mark_all_notifications_read');
  }

  deleteNotification(id: string): Observable<Message> {
    return rpc<Message>('delete_notification', { p_id: id });
  }
}
