import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, catchError, of, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { User } from '../models/user.model';
import { LoginRequest, RegisterRequest, AuthResponse } from '../models/auth.model';

const TOKEN_KEY = 'premadegg_token';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly baseUrl = environment.apiUrl;

  /** Signal reactivo con el usuario actual */
  private readonly currentUserSignal = signal<User | null>(null);

  /** Indica si la restauración de sesión ha terminado (true = listo) */
  private readonly sessionRestoredSignal = signal(false);

  /** Usuario actual como signal de solo lectura */
  readonly currentUser = this.currentUserSignal.asReadonly();

  /** ¿Ya se restauró la sesión? (true incluso si no había token) */
  readonly sessionRestored = this.sessionRestoredSignal.asReadonly();

  /** Computed: ¿está autenticado? */
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  /** Promesa que se resuelve cuando la restauración de sesión termina */
  readonly whenSessionRestored: Promise<void>;

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {
    // La Promise se crea aquí y se resuelve cuando restoreSession termina.
    // APP_INITIALIZER la espera antes de renderizar la app.
    this.whenSessionRestored = this.restoreSession();
  }

  /**
   * Si hay un token guardado, obtiene el usuario actual del backend.
   * Devuelve una Promise que se resuelve cuando la restauración termina.
   */
  private async restoreSession(): Promise<void> {
    const token = this.getToken();
    if (!token) {
      this.sessionRestoredSignal.set(true);
      return;
    }

    try {
      const user = await firstValueFrom(
        this.http.get<User>(`${this.baseUrl}/auth/me`).pipe(
          catchError((err: HttpErrorResponse) => {
            // Solo borrar el token si el servidor rechaza explícitamente la autenticación.
            // Errores de red u otros transitorios no deben cerrar la sesión.
            if (err.status === 401 || err.status === 403) {
              this.clearToken();
            }
            return of(null);
          }),
        ),
      );
      this.currentUserSignal.set(user);
    } catch {
      // Error inesperado (no debería llegar aquí gracias al catchError)
    } finally {
      this.sessionRestoredSignal.set(true);
    }
  }

  /**
   * Registro de nuevo usuario.
   */
  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/register`, data).pipe(
      tap((res) => {
        this.saveToken(res.token);
        this.currentUserSignal.set(res.user);
      }),
    );
  }

  /**
   * Login con email y contraseña.
   */
  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, data).pipe(
      tap((res) => {
        this.saveToken(res.token);
        this.currentUserSignal.set(res.user);
      }),
    );
  }

  /**
   * Cierra la sesión.
   */
  logout(): void {
    this.clearToken();
    this.currentUserSignal.set(null);
    this.router.navigate(['/']);
  }

  /**
   * Actualiza el perfil del usuario autenticado.
   */
  updateProfile(data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/auth/profile`, data).pipe(
      tap((user) => {
        this.currentUserSignal.set(user);
      }),
    );
  }

  /**
   * Sube un avatar y retorna la URL.
   */
  uploadAvatar(file: File): Observable<{ url: string; message: string }> {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.http.post<{ url: string; message: string }>(`${this.baseUrl}/upload/avatar`, formData);
  }

  // ── Token management ─────────────────────────────────
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private saveToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  private clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }
}
