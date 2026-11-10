CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  winner TEXT NOT NULL CHECK (winner IN ('citizens', 'impostors')),
  player_count INTEGER NOT NULL,
  impostor_count INTEGER NOT NULL,
  rounds INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  finished_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leaderboard (
  alias_key TEXT PRIMARY KEY,
  display_alias TEXT NOT NULL,
  games_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  citizen_wins INTEGER NOT NULL DEFAULT 0,
  impostor_wins INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC, wins DESC);
CREATE INDEX IF NOT EXISTS idx_games_finished_at ON games(finished_at DESC);
