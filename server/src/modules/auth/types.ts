// ============================================================
// Auth module types
// ============================================================

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  inviteCode?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    plan: string;
  };
  expiresIn: number;
}

export type OAuthProvider = 'google' | 'github';

export interface PasswordResetRequest {
  email: string;
  channel?: 'email' | 'sms';
}
