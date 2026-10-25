import { Injectable, signal, computed } from '@angular/core';
import { Observable, defer, firstValueFrom, tap } from 'rxjs';
import { Router } from '@angular/router';
import type { AuthError, Session } from '@supabase/supabase-js';
import { User } from '../models/user.model';
import { LoginRequest, RegisterRequest, AuthResponse, OnboardingRequest } from '../models/auth.model';
import { ApiError, invokeFunction, rpc, supabase } from './supabase.client';

export type OAuthProvider = 'google' | 'discord';

/** Traduce los errores de Supabase Auth más habituales */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email o contraseña incorrectos',
  user_already_exists: 'Ya existe una cuenta con ese email',
  email_exists: 'Ya existe una cuenta con ese email',
  email_not_confirmed: 'Confirma tu email antes de iniciar sesión',
  weak_password: 'La contraseña es demasiado débil (mínimo 6 caracteres)',
  over_email_send_rate_limit: 'Demasiados emails enviados. Inténtalo en unos minutos.',
  same_password: 'La nueva contraseña debe ser distinta a la anterior',
};

const toAuthError = (err: AuthError): ApiError => ({
  status: err.status ?? 400,
  error: { message: (err.code && AUTH_ERROR_MESSAGES[err.code]) || err.message, code: err.code },
});

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  /** Signal reactivo con el usuario actual (perfil de la tabla profiles) */
  private readonly currentUserSignal = signal<User | null>(null);

  /** Sesión de Supabase (JWT); la usa Realtime */
  private readonly sessionSignal = signal<Session | null>(null);

  /** Indica si la restauración de sesión ha terminado (true = listo) */
  private readonly sessionRestoredSignal = signal(false);

  /** El usuario llegó desde un enlace de recuperación de contraseña */
  private readonly passwordRecoverySignal = signal(false);

  /** Usuario actual como signal de solo lectura */
  readonly currentUser = this.currentUserSignal.asReadonly();

  readonly session = this.sessionSignal.asReadonly();

  /** ¿Ya se restauró la sesión? (true incluso si no había sesión) */
  readonly sessionRestored = this.sessionRestoredSignal.asReadonly();

  readonly passwordRecovery = this.passwordRecoverySignal.asReadonly();

  /** Computed: ¿está autenticado? */
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  /** Computed: ¿ha vinculado ya su Riot ID? (los usuarios de Google/Discord empiezan sin él) */
  readonly isOnboarded = computed(() => this.currentUserSignal()?.onboarded === true);

  /** Promesa que se resuelve cuando la restauración de sesión termina */
  readonly whenSessionRestored: Promise<void>;

  constructor(private readonly router: Router) {
    // APP_INITIALIZER espera esta promesa antes de renderizar la app.
    this.whenSessionRestored = this.restoreSession();

    supabase.auth.onAuthStateChange((event, session) => {
      this.sessionSignal.set(session);

      if (event === 'PASSWORD_RECOVERY') {
        this.passwordRecoverySignal.set(true);
      }

      if (event === 'SIGNED_OUT') {
        this.currentUserSignal.set(null);
        return;
      }

      // Login en otra pestaña o vuelta de OAuth: cargar el perfil.
      // setTimeout: Supabase recomienda no llamar a su API dentro del callback.
      if (event === 'SIGNED_IN' && session && this.currentUserSignal()?._id !== session.user.id) {
        setTimeout(() => void this.loadProfile());
      }
    });
  }

  /**
   * Recupera la sesión guardada (o la del enlace OAuth/recuperación en la URL)
   * y carga el perfil del usuario.
   */
  private async restoreSession(): Promise<void> {
    try {
      const { data } = await supabase.auth.getSession();
      this.sessionSignal.set(data.session);
      if (data.session) {
        await this.loadProfile();
        this.refreshRiotData();
      }
    } catch {
      // Error de red: la app arranca sin sesión
    } finally {
      this.sessionRestoredSignal.set(true);
    }
  }

  /** Carga el perfil del usuario autenticado desde la RPC get_me */
  async loadProfile(): Promise<User | null> {
    try {
      const user = await firstValueFrom(rpc<User | null>('get_me'));
      this.currentUserSignal.set(user);
      return user;
    } catch {
      this.currentUserSignal.set(null);
      return null;
    }
  }

  /** Actualiza rango/card desde Riot en segundo plano (la función respeta un cooldown de 1 h) */
  private refreshRiotData(): void {
    if (!this.currentUserSignal()?.onboarded) return;
    invokeFunction<{ updated: boolean; user: User }>('riot-refresh', {}).subscribe({
      next: (res) => {
        if (res.updated) this.currentUserSignal.set(res.user);
      },
      error: () => {
        // No bloquear la app si la API externa falla
      },
    });
  }

  /**
   * Registro con email. Guarda los datos de Riot en los metadatos del usuario y, si
   * hay sesión inmediata (confirmación de email desactivada), vincula la cuenta de Riot.
   * Si el proyecto exige confirmar el email, devuelve `emailConfirmationRequired`.
   */
  register(data: RegisterRequest): Observable<AuthResponse> {
    return defer(async () => {
      const { data: res, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { riotId: data.riotId, region: data.region, role: data.role, schedule: data.schedule },
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      });
      if (error) throw toAuthError(error);

      if (!res.session) {
        return { token: '', user: null, emailConfirmationRequired: true };
      }

      try {
        const user = await firstValueFrom(this.completeOnboarding(data));
        return { token: res.session.access_token, user };
      } catch (err) {
        // La cuenta existe pero falta el Riot ID: el componente lleva a /onboarding
        await this.loadProfile();
        throw { ...(err as ApiError), onboardingRequired: true };
      }
    });
  }

  /** Login con email y contraseña. */
  login(data: LoginRequest): Observable<AuthResponse> {
    return defer(async () => {
      const { data: res, error } = await supabase.auth.signInWithPassword(data);
      if (error) throw toAuthError(error);
      this.sessionSignal.set(res.session);
      const user = await this.loadProfile();
      this.refreshRiotData();
      return { token: res.session.access_token, user };
    });
  }

  /** Login con Google o Discord (redirige al proveedor y vuelve a returnUrl). */
  async loginWithProvider(provider: OAuthProvider, returnUrl = '/'): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${returnUrl}` },
    });
    if (error) throw toAuthError(error);
  }

  /** Vincula el Riot ID (onboarding). Lo hace la Edge Function riot-link. */
  completeOnboarding(data: OnboardingRequest): Observable<User> {
    return invokeFunction<User>('riot-link', {
      riotId: data.riotId,
      region: data.region,
      role: data.role,
      schedule: data.schedule,
    }).pipe(tap((user) => this.currentUserSignal.set(user)));
  }

  /** Datos de Riot que el usuario dejó en el registro (para rellenar el onboarding). */
  async getPendingOnboardingData(): Promise<Partial<OnboardingRequest>> {
    const { data } = await supabase.auth.getUser();
    const meta = data.user?.user_metadata ?? {};
    return { riotId: meta['riotId'], region: meta['region'], role: meta['role'], schedule: meta['schedule'] };
  }

  /** Cierra la sesión. */
  logout(): void {
    void supabase.auth.signOut();
    this.currentUserSignal.set(null);
    this.sessionSignal.set(null);
    this.router.navigate(['/']);
  }

  /** Envía el email de recuperación de contraseña. */
  requestPasswordReset(email: string): Observable<{ message: string }> {
    return defer(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw toAuthError(error);
      return { message: 'Si el email está registrado, recibirás un enlace para restablecer tu contraseña.' };
    });
  }

  /** Cambia la contraseña del usuario (tras abrir el enlace de recuperación). */
  updatePassword(password: string): Observable<{ message: string }> {
    return defer(async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw toAuthError(error);
      this.passwordRecoverySignal.set(false);
      return { message: 'Contraseña actualizada correctamente.' };
    });
  }

  /**
   * Actualiza el perfil del usuario autenticado.
   */
  updateProfile(data: Partial<User>): Observable<User> {
    return rpc<User>('update_my_profile', { p_data: data }).pipe(
      tap((user) => {
        this.currentUserSignal.set(user);
      }),
    );
  }

  /**
   * Sube un avatar a Supabase Storage (bucket avatars/<user_id>/) y retorna la URL pública.
   */
  uploadAvatar(file: File): Observable<{ url: string; message: string }> {
    return defer(async () => {
      const userId = this.currentUserSignal()?._id;
      if (!userId) throw { status: 401, error: { message: 'Debes iniciar sesión' } } as ApiError;

      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, {
        contentType: file.type,
        cacheControl: '31536000',
      });
      if (error) throw { status: 400, error: { message: error.message } } as ApiError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      return { url: data.publicUrl, message: 'Avatar subido correctamente' };
    });
  }

  // ── Token ────────────────────────────────────────────
  getToken(): string | null {
    return this.sessionSignal()?.access_token ?? null;
  }
}
