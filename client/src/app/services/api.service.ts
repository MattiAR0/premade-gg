import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { User } from '../models/user.model';
import { Reputation } from '../models/reputation.model';
import { LfgPost } from '../models/lfg-post.model';
import { RiotAccountValidation, RiotRankData } from '../models/riot.model';

/** Respuesta paginada genérica del backend (cursor-based) */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  totalPages: number;
  nextCursor: string | null;
}

// ── Cache en memoria con TTL ────────────────────────────
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60_000; // 1 minuto

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly baseUrl = environment.apiUrl;
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly http: HttpClient) {}

  private cacheKey(url: string, params: HttpParams): string {
    return `${url}?${params.toString()}`;
  }

  private cachedGet<T>(url: string, params: HttpParams, ttl = DEFAULT_TTL_MS): Observable<T> {
    const key = this.cacheKey(url, params);
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (entry && Date.now() < entry.expiresAt) {
      return of(entry.data);
    }

    return this.http.get<T>(url, { params }).pipe(
      tap((data) => {
        this.cache.set(key, { data, expiresAt: Date.now() + ttl });
      }),
    );
  }

  /** Invalida todo el cache */
  clearCache(): void {
    this.cache.clear();
  }

  /** Invalida entradas de cache que coincidan con un prefijo de URL */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  // ── Riot API (Proxy) ────────────────────────────────
  validateRiotId(gameName: string, tagLine: string): Observable<RiotAccountValidation> {
    return this.http.get<RiotAccountValidation>(
      `${this.baseUrl}/riot/validate/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    );
  }

  getRiotRank(region: string, gameName: string, tagLine: string): Observable<RiotRankData> {
    return this.http.get<RiotRankData>(
      `${this.baseUrl}/riot/rank/${region}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    );
  }

  // ── Users ───────────────────────────────────────────
  getUsers(filters?: {
    rank?: string;
    role?: string;
    minKarma?: number;
    cursor?: string;
    limit?: number;
  }): Observable<PaginatedResponse<User>> {
    let params = new HttpParams();
    if (filters?.rank) params = params.set('rank', filters.rank);
    if (filters?.role) params = params.set('role', filters.role);
    if (filters?.minKarma) params = params.set('minKarma', filters.minKarma.toString());
    if (filters?.cursor) params = params.set('cursor', filters.cursor);
    if (filters?.limit) params = params.set('limit', filters.limit.toString());
    return this.cachedGet<PaginatedResponse<User>>(`${this.baseUrl}/users`, params);
  }

  getUserById(id: string): Observable<User> {
    return this.cachedGet<User>(`${this.baseUrl}/users/${id}`, new HttpParams());
  }

  // ── Reviews ─────────────────────────────────────────
  getReviews(filters?: { target?: string; author?: string }): Observable<Reputation[]> {
    let params = new HttpParams();
    if (filters?.target) params = params.set('target', filters.target);
    if (filters?.author) params = params.set('author', filters.author);
    return this.cachedGet<Reputation[]>(`${this.baseUrl}/reviews`, params);
  }

  // ── LFG Posts ───────────────────────────────────────
  getLfgPosts(filters?: {
    teamSize?: number;
    status?: string;
    cursor?: string;
    limit?: number;
  }): Observable<PaginatedResponse<LfgPost>> {
    let params = new HttpParams();
    if (filters?.teamSize) params = params.set('teamSize', filters.teamSize.toString());
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.cursor) params = params.set('cursor', filters.cursor);
    if (filters?.limit) params = params.set('limit', filters.limit.toString());
    return this.cachedGet<PaginatedResponse<LfgPost>>(`${this.baseUrl}/lfg`, params);
  }

  getLfgPostById(id: string): Observable<LfgPost> {
    return this.http.get<LfgPost>(`${this.baseUrl}/lfg/${id}`);
  }

  createLfgPost(data: {
    title: string;
    description?: string;
    teamSize: number;
    minRank?: string;
    minKarma?: number;
    schedule?: string;
  }): Observable<LfgPost> {
    return this.http.post<LfgPost>(`${this.baseUrl}/lfg`, data).pipe(
      tap(() => this.invalidateByPrefix(`${this.baseUrl}/lfg`)),
    );
  }

  // ── LFG Miembros ────────────────────────────────────
  joinLfgPost(postId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/lfg/${postId}/join`, {});
  }

  handleLfgMember(postId: string, userId: string, action: 'accept' | 'reject'): Observable<{ message: string; post?: LfgPost }> {
    return this.http.put<{ message: string; post?: LfgPost }>(
      `${this.baseUrl}/lfg/${postId}/members/${userId}`,
      { action },
    );
  }

  leaveLfgPost(postId: string, userId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/lfg/${postId}/members/${userId}`,
    );
  }

  // ── LFG Posts by author ────────────────────────────
  getLfgPostsByAuthor(authorId: string): Observable<PaginatedResponse<LfgPost>> {
    const params = new HttpParams().set('author', authorId);
    return this.cachedGet<PaginatedResponse<LfgPost>>(`${this.baseUrl}/lfg`, params);
  }
}
