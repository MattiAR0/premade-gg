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

export interface AuthResponse {
  token: string;
  user: User | null;
  /** El proyecto exige confirmar el email antes de iniciar sesión */
  emailConfirmationRequired?: boolean;
}
