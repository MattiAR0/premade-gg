import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from '../models/user.model';
import { Reputation } from '../models/reputation.model';
import { LfgPost, MatchmakingResult } from '../models/lfg-post.model';
import { RiotAccountValidation, RiotRankData } from '../models/riot.model';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

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
  getUsers(filters?: { rank?: string; role?: string; minKarma?: number }): Observable<User[]> {
    let params = new HttpParams();
    if (filters?.rank) params = params.set('rank', filters.rank);
    if (filters?.role) params = params.set('role', filters.role);
    if (filters?.minKarma) params = params.set('minKarma', filters.minKarma.toString());
    return this.http.get<User[]>(`${this.baseUrl}/users`, { params });
  }

  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/users/${id}`);
  }

  // ── Reviews ─────────────────────────────────────────
  getReviews(filters?: { target?: string; author?: string }): Observable<Reputation[]> {
    let params = new HttpParams();
    if (filters?.target) params = params.set('target', filters.target);
    if (filters?.author) params = params.set('author', filters.author);
    return this.http.get<Reputation[]>(`${this.baseUrl}/reviews`, { params });
  }

  // ── LFG Posts ───────────────────────────────────────
  getLfgPosts(filters?: { role?: string; status?: string }): Observable<LfgPost[]> {
    let params = new HttpParams();
    if (filters?.role) params = params.set('role', filters.role);
    if (filters?.status) params = params.set('status', filters.status);
    return this.http.get<LfgPost[]>(`${this.baseUrl}/lfg`, { params });
  }

  getLfgPostById(id: string): Observable<LfgPost> {
    return this.http.get<LfgPost>(`${this.baseUrl}/lfg/${id}`);
  }

  getMatchmaking(postId: string): Observable<MatchmakingResult> {
    return this.http.get<MatchmakingResult>(`${this.baseUrl}/lfg/${postId}/matchmaking`);
  }
}
