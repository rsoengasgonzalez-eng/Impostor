import { DurableObject } from 'cloudflare:workers';
import { assignRoles, evaluateWinner, makeCode, sanitizeAlias, tallyVotes, type Role, type Winner } from './logic';
import { CATEGORY_NAMES, randomWord } from './words';

interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
  DB: D1Database;
  FRONTEND_URL: string;
}

type Phase = 'lobby' | 'reveal' | 'clues' | 'voting' | 'result' | 'finished';

interface Settings {
  categories: string[];
  revealSeconds: number;
  clueSeconds: number;
  voteSeconds: number;
  maxPlayers: number;
}

interface StoredPlayer {
  id: string;
  alias: string;
  token: string;
  role?: Role;
  alive: boolean;
  connected: boolean;
  score: number;
  joinedAt: number;
}

interface VoteResult {
  counts: Record<string, number>;
  eliminatedId: string | null;
  tied: boolean;
  wasImpostor: boolean | null;
}

interface RoomState {
  code: string;
  phase: Phase;
  hostId: string;
  settings: Settings;
  players: StoredPlayer[];
  category?: string;
  word?: string;
  round: number;
  clues: Record<string, string>;
  votes: Record<string, string>;
  ready: string[];
  voteResult?: VoteResult;
  deadline: number | null;
  winner: Winner;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  statsSaved?: boolean;
}

interface SocketAttachment {
  playerId: string;
}

const DEFAULT_SETTINGS: Settings = {
  categories: [...CATEGORY_NAMES],
  revealSeconds: 45,
  clueSeconds: 100,
  voteSeconds: 60,
  maxPlayers: 15,
};

const json = (data: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
});

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Ha ocurrido un error inesperado.';
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
};
const secureId = () => crypto.randomUUID();
const secureToken = () => `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin');
  const allowed = !origin || origin === env.FRONTEND_URL || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
  return {
    'Access-Control-Allow-Origin': allowed && origin ? origin : env.FRONTEND_URL,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json<Record<string, unknown>>();
  } catch {
    throw new Error('El cuerpo de la petición no es JSON válido.');
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      if (url.pathname === '/api/health') return json({ ok: true, service: 'impostor-party-api' }, 200, cors);
      if (url.pathname === '/api/categories' && request.method === 'GET') return json({ categories: CATEGORY_NAMES }, 200, cors);
      if (url.pathname === '/api/stats' && request.method === 'GET') {
        const limit = clamp(url.searchParams.get('limit'), 1, 50, 10);
        const result = await env.DB.prepare(
          'SELECT display_alias AS alias, games_played, wins, citizen_wins, impostor_wins, score FROM leaderboard ORDER BY score DESC, wins DESC LIMIT ?'
        ).bind(limit).all();
        return json({ leaderboard: result.results }, 200, cors);
      }

      if (url.pathname === '/api/rooms' && request.method === 'POST') {
        const body = await readBody(request);
        const alias = sanitizeAlias(body.alias);
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const code = makeCode();
          const id = env.ROOMS.idFromName(code);
          const response = await env.ROOMS.get(id).fetch('https://room.internal/create', {
            method: 'POST',
            body: JSON.stringify({ code, alias, settings: body.settings }),
          });
          if (response.ok) return new Response(response.body, { status: response.status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
          if (response.status !== 409) return new Response(response.body, { status: response.status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
        }
        throw new Error('No se pudo generar un código de sala. Inténtalo de nuevo.');
      }

      const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})(?:\/(join|snapshot|ws))?$/i);
      if (match) {
        const code = match[1].toUpperCase();
        const action = match[2];
        const room = env.ROOMS.get(env.ROOMS.idFromName(code));
        if (action === 'join' && request.method === 'POST') {
          const response = await room.fetch('https://room.internal/join', { method: 'POST', body: await request.text() });
          return new Response(response.body, { status: response.status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
        }
        if (action === 'snapshot' && request.method === 'GET') {
          const response = await room.fetch(`https://room.internal/snapshot?${url.searchParams.toString()}`);
          return new Response(response.body, { status: response.status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
        }
        if (action === 'ws' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
          return room.fetch(`https://room.internal/ws?${url.searchParams.toString()}`, { headers: request.headers });
        }
      }

      return json({ error: 'Ruta no encontrada.' }, 404, cors);
    } catch (error) {
      return json({ error: errorMessage(error) }, 400, cors);
    }
  },
} satisfies ExportedHandler<Env>;

export class GameRoom extends DurableObject<Env> {
  private room?: RoomState | null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

 private async load(): Promise<RoomState | null> {
  if (this.room !== undefined) {
    return this.room;
  }

  const storedRoom = await this.ctx.storage.get<RoomState>('room');
  this.room = storedRoom ?? null;

  return this.room;
}

  private async save(): Promise<void> {
    if (this.room) await this.ctx.storage.put('room', this.room);
  }

  private playerByAuth(playerId: string | null, token: string | null): StoredPlayer | null {
    if (!this.room || !playerId || !token) return null;
    return this.room.players.find((player) => player.id === playerId && player.token === token) ?? null;
  }

  private publicState(forPlayerId: string) {
    if (!this.room) return null;
    const self = this.room.players.find((player) => player.id === forPlayerId);
    const revealRoles = this.room.phase === 'finished';
    return {
      code: this.room.code,
      phase: this.room.phase,
      hostId: this.room.hostId,
      settings: this.room.settings,
      players: this.room.players.map((player) => ({
        id: player.id,
        alias: player.alias,
        alive: player.alive,
        connected: player.connected,
        score: player.score,
        isHost: player.id === this.room!.hostId,
        hasClue: Boolean(this.room!.clues[player.id]),
        hasVoted: Boolean(this.room!.votes[player.id]),
        revealedRole: revealRoles || !player.alive ? player.role : undefined,
      })),
      category: this.room.category,
      round: this.room.round,
      clues: Object.entries(this.room.clues).map(([playerId, clue]) => ({ playerId, clue })),
      voteResult: this.room.voteResult,
      deadline: this.room.deadline,
      winner: this.room.winner,
      self: self ? {
        id: self.id,
        role: this.room.phase === 'lobby' ? undefined : self.role,
        word: this.room.phase !== 'lobby' && self.role === 'citizen' ? this.room.word : undefined,
        ready: this.room.ready.includes(self.id),
        hasClue: Boolean(this.room.clues[self.id]),
        hasVoted: Boolean(this.room.votes[self.id]),
      } : null,
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    await this.load();

    try {
      if (url.pathname === '/create' && request.method === 'POST') {
        if (this.room) return json({ error: 'La sala ya existe.' }, 409);
        const body = await readBody(request);
        const player: StoredPlayer = {
          id: secureId(), alias: sanitizeAlias(body.alias), token: secureToken(), role: undefined,
          alive: true, connected: false, score: 0, joinedAt: Date.now(),
        };
        const rawSettings = typeof body.settings === 'object' && body.settings ? body.settings as Record<string, unknown> : {};
        this.room = {
          code: String(body.code), phase: 'lobby', hostId: player.id,
          settings: this.validSettings(rawSettings), players: [player], round: 0,
          clues: {}, votes: {}, ready: [], deadline: null, winner: null, createdAt: Date.now(),
        };
        await this.save();
        return json({ code: this.room.code, playerId: player.id, token: player.token });
      }

      if (!this.room) return json({ error: 'La sala no existe o ha caducado.' }, 404);

      if (url.pathname === '/join' && request.method === 'POST') {
        if (this.room.phase !== 'lobby') return json({ error: 'La partida ya ha comenzado.' }, 409);
        if (this.room.players.length >= this.room.settings.maxPlayers) return json({ error: 'La sala está completa.' }, 409);
        const body = await readBody(request);
        const alias = sanitizeAlias(body.alias);
        if (this.room.players.some((player) => player.alias.toLocaleLowerCase('es') === alias.toLocaleLowerCase('es'))) {
          return json({ error: 'Ese alias ya está en uso en la sala.' }, 409);
        }
        const player: StoredPlayer = {
          id: secureId(), alias, token: secureToken(), role: undefined,
          alive: true, connected: false, score: 0, joinedAt: Date.now(),
        };
        this.room.players.push(player);
        await this.save();
        await this.broadcast();
        return json({ code: this.room.code, playerId: player.id, token: player.token });
      }

      if (url.pathname === '/snapshot') {
        const player = this.playerByAuth(url.searchParams.get('playerId'), url.searchParams.get('token'));
        if (!player) return json({ error: 'Sesión no válida.' }, 401);
        return json({ type: 'snapshot', state: this.publicState(player.id) });
      }

      if (url.pathname === '/ws' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
        const player = this.playerByAuth(url.searchParams.get('playerId'), url.searchParams.get('token'));
        if (!player) return new Response('Sesión no válida.', { status: 401 });
        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({ playerId: player.id } satisfies SocketAttachment);
        player.connected = true;
        await this.save();
        server.send(JSON.stringify({ type: 'snapshot', state: this.publicState(player.id) }));
        await this.broadcast();
        return new Response(null, { status: 101, webSocket: client });
      }

      return json({ error: 'Operación no encontrada.' }, 404);
    } catch (error) {
      return json({ error: errorMessage(error) }, 400);
    }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.load();
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (!this.room || !attachment) return;
    try {
      const data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message)) as { type?: string; [key: string]: unknown };
      await this.handleAction(attachment.playerId, data);
      await this.save();
      await this.broadcast();
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', error: errorMessage(error) }));
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.setDisconnected(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.setDisconnected(ws);
  }

  private async setDisconnected(ws: WebSocket): Promise<void> {
    await this.load();
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    const player = this.room?.players.find((item) => item.id === attachment?.playerId);
    if (player) {
      player.connected = false;
      await this.save();
      await this.broadcast();
    }
  }

  private validSettings(input: Record<string, unknown>): Settings {
    const categories = Array.isArray(input.categories)
      ? input.categories.filter((item): item is string => typeof item === 'string' && CATEGORY_NAMES.includes(item))
      : DEFAULT_SETTINGS.categories;
    return {
      categories: categories.length ? [...new Set(categories)] : DEFAULT_SETTINGS.categories,
      revealSeconds: clamp(input.revealSeconds, 20, 120, DEFAULT_SETTINGS.revealSeconds),
      clueSeconds: clamp(input.clueSeconds, 45, 240, DEFAULT_SETTINGS.clueSeconds),
      voteSeconds: clamp(input.voteSeconds, 30, 120, DEFAULT_SETTINGS.voteSeconds),
      maxPlayers: 15,
    };
  }

  private requireHost(playerId: string): void {
    if (!this.room || this.room.hostId !== playerId) throw new Error('Solo el anfitrión puede hacer esto.');
  }

  private requireAlive(playerId: string): StoredPlayer {
    const player = this.room?.players.find((item) => item.id === playerId);
    if (!player?.alive) throw new Error('Los jugadores expulsados no pueden participar.');
    return player;
  }

  private async handleAction(playerId: string, action: { type?: string; [key: string]: unknown }): Promise<void> {
    if (!this.room) throw new Error('Sala no disponible.');
    if (!this.room.players.some((player) => player.id === playerId)) throw new Error('Jugador no encontrado.');

    switch (action.type) {
      case 'update_settings': {
        this.requireHost(playerId);
        if (this.room.phase !== 'lobby') throw new Error('La configuración ya está bloqueada.');
        this.room.settings = this.validSettings(action.settings as Record<string, unknown> ?? {});
        break;
      }
      case 'start_game': {
        this.requireHost(playerId);
        if (this.room.phase !== 'lobby') throw new Error('La partida ya ha comenzado.');
        if (this.room.players.length < 10 || this.room.players.length > 15) throw new Error('Se necesitan entre 10 y 15 jugadores.');
        const chosen = randomWord(this.room.settings.categories);
        this.room.players = assignRoles(this.room.players.map((player) => ({ ...player, alive: true, score: 0 })));
        this.room.word = chosen.word;
        this.room.category = chosen.category;
        this.room.phase = 'reveal';
        this.room.round = 1;
        this.room.clues = {};
        this.room.votes = {};
        this.room.ready = [];
        this.room.voteResult = undefined;
        this.room.winner = null;
        this.room.startedAt = Date.now();
        await this.setDeadline(this.room.settings.revealSeconds);
        break;
      }
      case 'ready': {
        this.requireAlive(playerId);
        if (this.room.phase !== 'reveal') throw new Error('No estamos descubriendo roles.');
        if (!this.room.ready.includes(playerId)) this.room.ready.push(playerId);
        if (this.room.players.filter((player) => player.alive).every((player) => this.room!.ready.includes(player.id))) {
          await this.beginClues();
        }
        break;
      }
      case 'submit_clue': {
        this.requireAlive(playerId);
        if (this.room.phase !== 'clues') throw new Error('Ahora no se pueden enviar pistas.');
        if (this.room.clues[playerId]) throw new Error('Ya has enviado tu pista.');
        const clue = typeof action.clue === 'string' ? action.clue.trim().replace(/\s+/g, ' ').slice(0, 60) : '';
        if (clue.length < 2) throw new Error('La pista debe tener al menos 2 caracteres.');
        if (this.room.word && clue.toLocaleLowerCase('es').includes(this.room.word.toLocaleLowerCase('es'))) {
          throw new Error('La pista no puede contener la palabra secreta.');
        }
        this.room.clues[playerId] = clue;
        if (this.room.players.filter((player) => player.alive).every((player) => Boolean(this.room!.clues[player.id]))) {
          await this.beginVoting();
        }
        break;
      }
      case 'vote': {
        this.requireAlive(playerId);
        if (this.room.phase !== 'voting') throw new Error('La votación no está abierta.');
        if (this.room.votes[playerId]) throw new Error('Tu voto ya está registrado.');
        const targetId = String(action.targetId ?? '');
        if (targetId === playerId) throw new Error('No puedes votarte a ti mismo.');
        const target = this.room.players.find((player) => player.id === targetId && player.alive);
        if (!target) throw new Error('El candidato no es válido.');
        this.room.votes[playerId] = targetId;
        if (this.room.players.filter((player) => player.alive).every((player) => Boolean(this.room!.votes[player.id]))) {
          await this.closeVoting();
        }
        break;
      }
      case 'advance': {
        this.requireHost(playerId);
        if (this.room.phase === 'reveal') await this.beginClues();
        else if (this.room.phase === 'clues') await this.beginVoting();
        else if (this.room.phase === 'voting') await this.closeVoting();
        else if (this.room.phase === 'result') await this.afterResult();
        else throw new Error('No se puede avanzar en esta fase.');
        break;
      }
      case 'kick': {
        this.requireHost(playerId);
        if (this.room.phase !== 'lobby') throw new Error('Solo se puede expulsar de la sala antes de empezar.');
        const targetId = String(action.targetId ?? '');
        if (targetId === playerId) throw new Error('El anfitrión no puede expulsarse a sí mismo.');
        this.room.players = this.room.players.filter((player) => player.id !== targetId);
        for (const socket of this.ctx.getWebSockets()) {
          const attachment = socket.deserializeAttachment() as SocketAttachment | null;
          if (attachment?.playerId === targetId) socket.close(4001, 'Expulsado por el anfitrión');
        }
        break;
      }
      case 'play_again': {
        this.requireHost(playerId);
        if (this.room.phase !== 'finished') throw new Error('La partida aún no ha terminado.');
        this.room.phase = 'lobby';
        this.room.round = 0;
        this.room.category = undefined;
        this.room.word = undefined;
        this.room.clues = {};
        this.room.votes = {};
        this.room.ready = [];
        this.room.voteResult = undefined;
        this.room.deadline = null;
        this.room.winner = null;
        this.room.startedAt = undefined;
        this.room.finishedAt = undefined;
        this.room.statsSaved = false;
        this.room.players = this.room.players.map((player) => ({ ...player, role: undefined, alive: true, score: 0 }));
        await this.ctx.storage.deleteAlarm();
        break;
      }
      default:
        throw new Error('Acción desconocida.');
    }
  }

  private async setDeadline(seconds: number): Promise<void> {
    if (!this.room) return;
    this.room.deadline = Date.now() + seconds * 1000;
    await this.ctx.storage.setAlarm(this.room.deadline);
  }

  private async beginClues(): Promise<void> {
    if (!this.room) return;
    this.room.phase = 'clues';
    this.room.clues = {};
    this.room.votes = {};
    this.room.voteResult = undefined;
    await this.setDeadline(this.room.settings.clueSeconds);
  }

  private async beginVoting(): Promise<void> {
    if (!this.room) return;
    this.room.phase = 'voting';
    this.room.votes = {};
    await this.setDeadline(this.room.settings.voteSeconds);
  }

  private async closeVoting(): Promise<void> {
    if (!this.room || this.room.phase !== 'voting') return;
    const aliveIds = new Set(this.room.players.filter((player) => player.alive).map((player) => player.id));
    const result = tallyVotes(this.room.votes, aliveIds);
    const eliminated = result.eliminatedId ? this.room.players.find((player) => player.id === result.eliminatedId) : undefined;
    if (eliminated) {
      eliminated.alive = false;
      for (const [voterId, targetId] of Object.entries(this.room.votes)) {
        const voter = this.room.players.find((player) => player.id === voterId);
        const target = this.room.players.find((player) => player.id === targetId);
        if (voter && target?.role === 'impostor') voter.score += 2;
      }
      if (eliminated.role === 'impostor') {
        for (const player of this.room.players.filter((item) => item.role === 'citizen' && item.alive)) player.score += 5;
      }
    }
    for (const player of this.room.players.filter((item) => item.role === 'impostor' && item.alive)) player.score += 3;
    this.room.voteResult = {
      counts: result.counts,
      eliminatedId: result.eliminatedId,
      tied: result.tied,
      wasImpostor: eliminated ? eliminated.role === 'impostor' : null,
    };
    this.room.winner = evaluateWinner(this.room.players);
    if (!this.room.winner && this.room.round >= 8) this.room.winner = 'impostors';
    this.room.phase = 'result';
    await this.setDeadline(12);
  }

  private async afterResult(): Promise<void> {
    if (!this.room || this.room.phase !== 'result') return;
    if (this.room.winner) {
      await this.finish();
      return;
    }
    this.room.round += 1;
    await this.beginClues();
  }

  private async finish(): Promise<void> {
    if (!this.room || !this.room.winner) return;
    this.room.phase = 'finished';
    this.room.deadline = null;
    this.room.finishedAt = Date.now();
    await this.ctx.storage.deleteAlarm();
    await this.persistStats();
  }

  async alarm(): Promise<void> {
    await this.load();
    if (!this.room || !this.room.deadline || Date.now() + 250 < this.room.deadline) return;
    if (this.room.phase === 'reveal') await this.beginClues();
    else if (this.room.phase === 'clues') await this.beginVoting();
    else if (this.room.phase === 'voting') await this.closeVoting();
    else if (this.room.phase === 'result') await this.afterResult();
    await this.save();
    await this.broadcast();
  }

  private async persistStats(): Promise<void> {
    if (!this.room || !this.room.winner || this.room.statsSaved) return;
    const gameId = secureId();
    const duration = Math.max(0, Math.round(((this.room.finishedAt ?? Date.now()) - (this.room.startedAt ?? Date.now())) / 1000));
    const impostorCount = this.room.players.filter((player) => player.role === 'impostor').length;
    const statements = [
      this.env.DB.prepare(
        'INSERT INTO games (id, room_code, winner, player_count, impostor_count, rounds, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(gameId, this.room.code, this.room.winner, this.room.players.length, impostorCount, this.room.round, duration),
      ...this.room.players.map((player) => {
        const won = (player.role === 'impostor' && this.room!.winner === 'impostors') || (player.role === 'citizen' && this.room!.winner === 'citizens');
        const citizenWin = won && player.role === 'citizen' ? 1 : 0;
        const impostorWin = won && player.role === 'impostor' ? 1 : 0;
        const points = player.score + (won ? 10 : 0);
        const key = player.alias.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return this.env.DB.prepare(`
          INSERT INTO leaderboard (alias_key, display_alias, games_played, wins, citizen_wins, impostor_wins, score)
          VALUES (?, ?, 1, ?, ?, ?, ?)
          ON CONFLICT(alias_key) DO UPDATE SET
            display_alias = excluded.display_alias,
            games_played = games_played + 1,
            wins = wins + excluded.wins,
            citizen_wins = citizen_wins + excluded.citizen_wins,
            impostor_wins = impostor_wins + excluded.impostor_wins,
            score = score + excluded.score,
            updated_at = CURRENT_TIMESTAMP
        `).bind(key, player.alias, won ? 1 : 0, citizenWin, impostorWin, points);
      }),
    ];
    try {
      await this.env.DB.batch(statements);
      this.room.statsSaved = true;
    } catch (error) {
      console.error('No se pudieron persistir las estadísticas', error);
    }
  }

  private async broadcast(): Promise<void> {
    if (!this.room) return;
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as SocketAttachment | null;
      if (!attachment) continue;
      try {
        socket.send(JSON.stringify({ type: 'snapshot', state: this.publicState(attachment.playerId) }));
      } catch {
        // El cierre del socket se reflejará en webSocketClose/webSocketError.
      }
    }
  }
}
