import { api } from './api';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
}

/**
 * Get current authenticated user
 */
export async function getMe(): Promise<User> {
  const response = await api.get<AuthResponse>('/auth/me');
  return response.data.user;
}

/**
 * Login user
 */
export async function login(email: string, password: string): Promise<User> {
  const response = await api.post<AuthResponse>('/auth/login', { email, password });
  return response.data.user;
}

/**
 * Register new user
 */
export async function register(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  binanceApiKey: string,
  binanceSecretKey: string
): Promise<User> {
  const response = await api.post<AuthResponse>('/auth/register', {
    email,
    password,
    firstName,
    lastName,
    binanceApiKey,
    binanceSecretKey,
  });
  return response.data.user;
}

/**
 * Refresh access token
 */
export async function refreshToken(): Promise<User> {
  const response = await api.post<AuthResponse>('/auth/refresh');
  return response.data.user;
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

/**
 * Get WebSocket authentication token
 */
export async function getWebSocketToken(): Promise<string> {
  const response = await api.get<{ token: string }>('/auth/ws-token');
  return response.data.token;
}

