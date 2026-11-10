import type { GameState, LeaderboardRow, Session, Settings } from './types';

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? 'No se pudo completar la operación.');
  return data;
}

export const createRoom = (alias: string, settings?: Partial<Settings>) => request<Session>('/api/rooms', {
  method: 'POST',
  body: JSON.stringify({ alias, settings }),
});

export const joinRoom = (code: string, alias: string) => request<Session>(`/api/rooms/${code}/join`, {
  method: 'POST',
  body: JSON.stringify({ alias }),
});

export const getSnapshot = async (session: Session) => {
  const params = new URLSearchParams({ playerId: session.playerId, token: session.token });
  const payload = await request<{ type: 'snapshot'; state: GameState }>(`/api/rooms/${session.code}/snapshot?${params}`);
  return payload.state;
};

export const getLeaderboard = () => request<{ leaderboard: LeaderboardRow[] }>('/api/stats?limit=10');

export function socketUrl(session: Session): string {
  const base = API_URL || window.location.origin;
  const url = new URL(`${base}/api/rooms/${session.code}/ws`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('playerId', session.playerId);
  url.searchParams.set('token', session.token);
  return url.toString();
}
