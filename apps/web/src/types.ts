export type Phase = 'lobby' | 'reveal' | 'clues' | 'voting' | 'result' | 'finished';
export type Role = 'citizen' | 'impostor';

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

export interface GameState {
  code: string;
  phase: Phase;
  hostId: string;
  settings: Settings;
  players: PublicPlayer[];
  category?: string;
  round: number;
  clues: Array<{ playerId: string; clue: string }>;
  voteResult?: {
    counts: Record<string, number>;
    eliminatedId: string | null;
    tied: boolean;
    wasImpostor: boolean | null;
  };
  deadline: number | null;
  winner: 'citizens' | 'impostors' | null;
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

export interface LeaderboardRow {
  alias: string;
  games_played: number;
  wins: number;
  citizen_wins: number;
  impostor_wins: number;
  score: number;
}
