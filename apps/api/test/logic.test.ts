import { describe, expect, it } from 'vitest';
import { assignRoles, evaluateWinner, impostorCountFor, sanitizeAlias, tallyVotes } from '../src/logic';

describe('reglas del juego', () => {
  it('usa un impostor con 10-12 y dos con 13-15', () => {
    expect(impostorCountFor(10)).toBe(1);
    expect(impostorCountFor(12)).toBe(1);
    expect(impostorCountFor(13)).toBe(2);
    expect(impostorCountFor(15)).toBe(2);
  });

  it('asigna exactamente los roles esperados', () => {
    const players = Array.from({ length: 13 }, (_, index) => ({ id: String(index), alive: true }));
    const assigned = assignRoles(players, () => 0.42);
    expect(assigned.filter((player) => player.role === 'impostor')).toHaveLength(2);
  });

  it('resuelve votos y conserva los empates', () => {
    const candidates = new Set(['a', 'b', 'c']);
    expect(tallyVotes({ x: 'a', y: 'a', z: 'b' }, candidates).eliminatedId).toBe('a');
    expect(tallyVotes({ x: 'a', y: 'b' }, candidates).eliminatedId).toBeNull();
  });

  it('detecta condiciones de victoria', () => {
    expect(evaluateWinner([{ id: '1', alive: true, role: 'citizen' }])).toBe('citizens');
    expect(evaluateWinner([
      { id: '1', alive: true, role: 'citizen' },
      { id: '2', alive: true, role: 'impostor' },
    ])).toBe('impostors');
  });

  it('normaliza alias y rechaza entradas inválidas', () => {
    expect(sanitizeAlias('  Roi   Madrid  ')).toBe('Roi Madrid');
    expect(() => sanitizeAlias('<script>')).toThrow();
  });
});
