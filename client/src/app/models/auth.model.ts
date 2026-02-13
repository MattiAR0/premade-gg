import { User } from './user.model';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  riotId: string;
  region: string;
  role: string;
  schedule: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
