export type Phase = 'lobby' | 'reveal' | 'clues' | 'voting' | 'result' | 'finished';
export type Role = 'citizen' | 'impostor';
export type Winner = 'citizens' | 'impostors' | null;

export interface Settings {
  categories: string[];
  revealSeconds: number;
  clueSeconds: number;
  voteSeconds: number;
  maxPlayers: number;
}

export interface PublicPlayer {
  id: string;
  alias: string;
  alive: boolean;
  connected: boolean;
  score: number;
  isHost: boolean;
  hasClue: boolean;
  hasVoted: boolean;
  revealedRole?: Role;
}

export interface VoteResult {
  counts: Record<string, number>;
  eliminatedId: string | null;
  tied: boolean;
  wasImpostor: boolean | null;
}

export interface RoomState {
  code: string;
  phase: Phase;
  hostId: string;
  settings: Settings;
  players: PublicPlayer[];
  category?: string;
  round: number;
  clues: Array<{ playerId: string; clue: string }>;
  voteResult?: VoteResult;
  deadline: number | null;
  winner: Winner;
  self: {
    id: string;
    role?: Role;
    word?: string;
    ready: boolean;
    hasClue: boolean;
    hasVoted: boolean;
  } | null;
}

export interface Session {
  code: string;
  playerId: string;
  token: string;
}

export interface LeaderboardEntry {
  alias: string;
  games_played: number;
  wins: number;
  citizen_wins: number;
  impostor_wins: number;
  score: number;
}

export type ClientAction =
  | { type: 'update_settings'; settings: Partial<Settings> }
  | { type: 'start_game' }
  | { type: 'ready' }
  | { type: 'submit_clue'; clue: string }
  | { type: 'vote'; targetId: string }
  | { type: 'advance' }
  | { type: 'kick'; targetId: string }
  | { type: 'play_again' };

export type ServerMessage =
  | { type: 'snapshot'; state: RoomState }
  | { type: 'error'; error: string };

type ViteEnvironment = {
  VITE_API_URL?: string;
};

// This local type keeps api.ts self-contained even when vite/client is not included
// by the Cloudflare TypeScript build. Vite still replaces import.meta.env at build time.
const viteEnvironment = (import.meta as ImportMeta & { env?: ViteEnvironment }).env;
const configuredApiUrl = viteEnvironment?.VITE_API_URL?.trim();

export const API_URL = (configuredApiUrl || window.location.origin).replace(/\/+$/, '');

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;

  if (!response.ok) {
    throw new Error(payload?.error || `La petición ha fallado (${response.status}).`);
  }

  if (!payload) {
    throw new Error('La API ha devuelto una respuesta vacía.');
  }

  return payload;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return readJson<T>(response);
}

export function createRoom(alias: string, settings?: Partial<Settings>): Promise<Session> {
  return post<Session>('/api/rooms', { alias, settings });
}

export function joinRoom(code: string, alias: string): Promise<Session> {
  const normalizedCode = normalizeCode(code);
  return post<Session>(`/api/rooms/${encodeURIComponent(normalizedCode)}/join`, { alias });
}

export async function getSnapshot(session: Session): Promise<RoomState> {
  const params = new URLSearchParams({
    playerId: session.playerId,
    token: session.token,
  });
  const response = await fetch(
    `${API_URL}/api/rooms/${encodeURIComponent(normalizeCode(session.code))}/snapshot?${params.toString()}`,
  );
  const message = await readJson<{ type: 'snapshot'; state: RoomState }>(response);
  return message.state;
}

export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const safeLimit = Math.min(50, Math.max(1, Math.round(limit)));
  const response = await fetch(`${API_URL}/api/stats?limit=${safeLimit}`);
  const payload = await readJson<{ leaderboard: LeaderboardEntry[] }>(response);
  return payload.leaderboard;
}

export async function getCategories(): Promise<string[]> {
  const response = await fetch(`${API_URL}/api/categories`);
  const payload = await readJson<{ categories: string[] }>(response);
  return payload.categories;
}

export function getRoomSocketUrl(session: Session): string {
  const url = new URL(
    `${API_URL}/api/rooms/${encodeURIComponent(normalizeCode(session.code))}/ws`,
    window.location.origin,
  );
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.search = new URLSearchParams({
    playerId: session.playerId,
    token: session.token,
  }).toString();
  return url.toString();
}

export function openRoomSocket(session: Session): WebSocket {
  return new WebSocket(getRoomSocketUrl(session));
}
