import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { User } from '../models/user.model';
import { Reputation } from '../models/reputation.model';
import { LfgPost, MatchmakingResult } from '../models/lfg-post.model';
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
// Cada entrada guarda el dato y cuándo expira.
// Se usa solo para GETs de listados, donde los datos no cambian tan rápido.
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

  /**
   * Genera una clave de cache a partir de la URL y los params.
   * Dos peticiones idénticas producen la misma clave.
   */
  private cacheKey(url: string, params: HttpParams): string {
    return `${url}?${params.toString()}`;
  }

  /**
   * GET con cache en memoria. Si hay una entrada válida (no expirada),
   * la devuelve como Observable sin hacer HTTP. Si no, ejecuta la petición
   * y guarda el resultado.
   */
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

  /** Invalida todo el cache (útil tras crear/editar/borrar recursos) */
  clearCache(): void {
    this.cache.clear();
  }

  // ── Riot API (Proxy) ────────────────────────────────
  validateRiotId(gameName: string, tagLine: string): Observable<RiotAccountValidation> {
    return this.http.get<RiotAccountValidation>(
      `${this.baseUrl}/riot/validate/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    );
  }

  getRiotRank(
    region: string,
    gameName: string,
    tagLine: string,
  ): Observable<RiotRankData> {
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
    role?: string;
    status?: string;
    cursor?: string;
    limit?: number;
  }): Observable<PaginatedResponse<LfgPost>> {
    let params = new HttpParams();
    if (filters?.role) params = params.set('role', filters.role);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.cursor) params = params.set('cursor', filters.cursor);
    if (filters?.limit) params = params.set('limit', filters.limit.toString());
    return this.cachedGet<PaginatedResponse<LfgPost>>(`${this.baseUrl}/lfg`, params);
  }

  getLfgPostById(id: string): Observable<LfgPost> {
    return this.cachedGet<LfgPost>(`${this.baseUrl}/lfg/${id}`, new HttpParams());
  }

  getMatchmaking(postId: string): Observable<MatchmakingResult> {
    return this.cachedGet<MatchmakingResult>(
      `${this.baseUrl}/lfg/${postId}/matchmaking`,
      new HttpParams(),
      30_000, // TTL 30s para matchmaking (datos más volátiles)
    );
  }
}
