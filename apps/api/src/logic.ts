export type Role = 'citizen' | 'impostor';
export type Winner = 'citizens' | 'impostors' | null;

export interface PlayerForLogic {
  id: string;
  alive: boolean;
  role?: Role;
}

export function impostorCountFor(playerCount: number): number {
  if (playerCount < 10 || playerCount > 15) {
    throw new Error('La partida requiere entre 10 y 15 jugadores.');
  }
  return playerCount >= 13 ? 2 : 1;
}

export function shuffled<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(rng() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

export function assignRoles<T extends PlayerForLogic>(players: T[], rng: () => number = Math.random): T[] {
  const impostors = new Set(shuffled(players.map((player) => player.id), rng).slice(0, impostorCountFor(players.length)));
  return players.map((player) => ({
    ...player,
    role: impostors.has(player.id) ? 'impostor' : 'citizen',
  }));
}

export interface VoteResult {
  counts: Record<string, number>;
  eliminatedId: string | null;
  tied: boolean;
}

export function tallyVotes(votes: Record<string, string>, validCandidateIds: Set<string>): VoteResult {
  const counts: Record<string, number> = {};
  for (const candidateId of Object.values(votes)) {
    if (!validCandidateIds.has(candidateId)) continue;
    counts[candidateId] = (counts[candidateId] ?? 0) + 1;
  }

  const ordered = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!ordered.length) return { counts, eliminatedId: null, tied: true };
  const tied = ordered.length > 1 && ordered[0][1] === ordered[1][1];
  return { counts, eliminatedId: tied ? null : ordered[0][0], tied };
}

export function evaluateWinner(players: PlayerForLogic[]): Winner {
  const alive = players.filter((player) => player.alive);
  const impostors = alive.filter((player) => player.role === 'impostor').length;
  const citizens = alive.length - impostors;
  if (impostors === 0) return 'citizens';
  if (impostors >= citizens) return 'impostors';
  return null;
}

export function sanitizeAlias(value: unknown): string {
  if (typeof value !== 'string') throw new Error('El alias no es válido.');
  const alias = value.trim().replace(/\s+/g, ' ').slice(0, 20);
  if (alias.length < 2) throw new Error('El alias debe tener al menos 2 caracteres.');
  if (!/^[\p{L}\p{N} ._\-áéíóúüñÁÉÍÓÚÜÑ]+$/u.test(alias)) {
    throw new Error('El alias contiene caracteres no permitidos.');
  }
  return alias;
}

export function makeCode(rng: () => number = Math.random): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(rng() * alphabet.length)]).join('');
}
