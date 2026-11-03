import { User } from './user.model';

export interface LoginRequest {
  email: string;
  password: string;
}

/** Datos de Riot que se piden al vincular la cuenta (registro u onboarding) */
export interface OnboardingRequest {
  riotId: string;
  region: string;
  role: string;
  schedule: string;
}

export interface RegisterRequest extends OnboardingRequest {
  email: string;
  password: string;
}

/** Datos de acceso de la cuenta (Supabase Auth), para la página de ajustes */
export interface AccountInfo {
  email: string;
  /** Email nuevo a la espera de que se confirme el cambio */
  pendingEmail: string | null;
  /** Tiene contraseña propia (alta con email); false si solo entra con Google o Discord */
  hasPassword: boolean;
  /** Proveedores OAuth vinculados: 'google', 'discord' */
  oauthProviders: string[];
}

export interface AuthResponse {
  token: string;
  user: User | null;
  /** El proyecto exige confirmar el email antes de iniciar sesión */
  emailConfirmationRequired?: boolean;
}
