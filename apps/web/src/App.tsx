import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import {
  ArrowRight, Check, Clock3, Copy, Crown, Eye, EyeOff, Gamepad2, LogOut, Medal,
  MessageCircle, Radio, RotateCcw, Send, Settings2, Shield, Sparkles, Trophy, UserRoundX,
  Users, Vote, Wifi, WifiOff, X,
} from 'lucide-react';
import { createRoom, getLeaderboard, getSnapshot, joinRoom, socketUrl } from './api';
import type { GameState, LeaderboardRow, PublicPlayer, Session } from './types';

const CATEGORIES = ['Cultura general', 'Comida', 'Viajes', 'Cine y series', 'Música', 'Deportes', 'Videojuegos', 'Fiesta', 'España'];
const AVATAR_COLORS = ['#ff4d8d', '#8b5cf6', '#15d7c8', '#f59e0b', '#3b82f6', '#ef4444'];

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`logo ${compact ? 'logo--compact' : ''}`} aria-label="Impostor Party">
    <span className="logo__mark"><Eye size={compact ? 18 : 24} /></span>
    <span>IMPOSTOR</span><strong>PARTY</strong>
  </div>;
}

function initials(alias: string) {
  return alias.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function avatarColor(id: string) {
  return AVATAR_COLORS[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length];
}

function Avatar({ player, small = false }: { player: PublicPlayer; small?: boolean }) {
  return <span className={`avatar ${small ? 'avatar--small' : ''} ${!player.alive ? 'avatar--out' : ''}`} style={{ '--avatar-color': avatarColor(player.id) } as CSSProperties}>
    {initials(player.alias)}
    <i className={player.connected ? 'online' : 'offline'} />
  </span>;
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}

function useCountdown(deadline: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadline]);
  return deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
}

function Timer({ deadline }: { deadline: number | null }) {
  const seconds = useCountdown(deadline);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return <div className={`timer ${seconds <= 10 ? 'timer--urgent' : ''}`}><Clock3 size={17} /> {minutes}:{String(rest).padStart(2, '0')}</div>;
}

function ProgressHeader({ state, connected }: { state: GameState; connected: boolean }) {
  return <header className="game-header">
    <Logo compact />
    <div className="game-header__meta">
      {state.phase !== 'lobby' && <span>Ronda {state.round}</span>}
      <span className={`connection ${connected ? '' : 'connection--off'}`}>{connected ? <Wifi size={14} /> : <WifiOff size={14} />}{connected ? 'En directo' : 'Reconectando'}</span>
    </div>
  </header>;
}

function Home({ initialCode, onSession }: { initialCode: string; onSession: (session: Session) => void }) {
  const [mode, setMode] = useState<'create' | 'join'>(initialCode ? 'join' : 'create');
  const [alias, setAlias] = useState('');
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  useEffect(() => { getLeaderboard().then((data) => setLeaderboard(data.leaderboard)).catch(() => undefined); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const session = mode === 'create' ? await createRoom(alias) : await joinRoom(code.trim().toUpperCase(), alias);
      onSession(session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo entrar.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="home">
    <div className="ambient ambient--one" /><div className="ambient ambient--two" />
    <nav className="home__nav"><Logo /><span className="nav-pill"><Radio size={14} /> Multijugador en vivo</span></nav>
    <div className="hero-grid">
      <section className="hero-copy">
        <span className="eyebrow"><Sparkles size={15} /> Mentir nunca fue tan divertido</span>
        <h1>Encuentra al<br /><em>impostor</em> entre<br />tus amigos.</h1>
        <p>Una palabra secreta. Hasta 15 jugadores. Uno o dos infiltrados. ¿Podréis descubrirlos antes de que sea tarde?</p>
        <div className="feature-row"><span><Users />10–15 jugadores</span><span><Shield />Roles privados</span><span><Vote />Voto secreto</span></div>
      </section>
      <Panel className="entry-card">
        <div className="entry-tabs">
          <button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Crear sala</button>
          <button className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>Unirme</button>
        </div>
        <form onSubmit={submit}>
          <label>Tu alias</label>
          <input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="¿Cómo te llamamos?" maxLength={20} autoComplete="nickname" required />
          {mode === 'join' && <><label>Código de sala</label><input className="code-input" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="ABC123" minLength={6} maxLength={6} required /></>}
          {error && <p className="form-error">{error}</p>}
          <button className="button button--primary button--full" disabled={busy}>{busy ? <span className="spinner" /> : <Gamepad2 />}{busy ? 'Preparando…' : mode === 'create' ? 'Crear partida' : 'Entrar en la sala'}<ArrowRight /></button>
        </form>
        <p className="entry-note">Sin descargas · Gratis · Optimizado para móvil</p>
      </Panel>
    </div>
    {leaderboard.length > 0 && <section className="home-ranking">
      <div><span className="eyebrow"><Trophy size={15} /> Hall of fame</span><h2>Los mejores mentirosos</h2></div>
      <div className="ranking-strip">{leaderboard.slice(0, 5).map((row, index) => <span key={row.alias}><b>#{index + 1}</b>{row.alias}<strong>{row.score} pts</strong></span>)}</div>
    </section>}
  </main>;
}

function Lobby({ state, send, onLeave }: ScreenProps & { onLeave: () => void }) {
  const isHost = state.self?.id === state.hostId;
  const enough = state.players.length >= 10;
  const shareUrl = `${window.location.origin}/join/${state.code}`;
  const [copied, setCopied] = useState(false);

  function shareWhatsApp() {
    const text = `🕵️ ¿QUIÉN ES EL IMPOSTOR?\n\nEntra en mi partida de Impostor Party.\n👥 10–15 jugadores\n🔑 Sala: ${state.code}\n\n${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }
  async function copyCode() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }
  function toggleCategory(category: string) {
    if (!isHost) return;
    const selected = state.settings.categories.includes(category);
    const categories = selected ? state.settings.categories.filter((item) => item !== category) : [...state.settings.categories, category];
    if (categories.length) send({ type: 'update_settings', settings: { ...state.settings, categories } });
  }

  return <div className="screen lobby">
    <div className="lobby__top">
      <div><span className="overline">Código de sala</span><button className="room-code" onClick={copyCode}>{state.code}{copied ? <Check /> : <Copy />}</button></div>
      <div className="lobby__actions"><button className="icon-button" onClick={onLeave} title="Salir"><LogOut /></button><button className="button button--whatsapp" onClick={shareWhatsApp}><MessageCircle /> Compartir</button></div>
    </div>
    <div className="lobby-grid">
      <Panel className="players-panel">
        <div className="section-title"><div><span className="overline">Tripulación</span><h2>Jugadores <b>{state.players.length}/15</b></h2></div><span className={enough ? 'status-ready' : 'status-wait'}>{enough ? <><Check /> Listos</> : `${10 - state.players.length} más`}</span></div>
        <div className="player-grid">{state.players.map((player, index) => <div className="player-card pop-in" style={{ animationDelay: `${index * 35}ms` }} key={player.id}>
          <Avatar player={player} />
          <span>{player.alias}{player.id === state.self?.id && <small>Tú</small>}</span>
          {player.isHost && <Crown className="crown" />}
          {!player.connected && <i className="disconnected">offline</i>}
          {isHost && !player.isHost && <button className="kick" title={`Expulsar a ${player.alias}`} onClick={() => send({ type: 'kick', targetId: player.id })}><X /></button>}
        </div>)}</div>
        {state.players.length < 15 && <div className="empty-seats">{Array.from({ length: Math.min(3, 15 - state.players.length) }).map((_, index) => <span key={index}><Users /> Esperando…</span>)}</div>}
      </Panel>
      <Panel className="settings-panel">
        <div className="section-title"><div><span className="overline">Configuración</span><h2><Settings2 /> Partida</h2></div>{!isHost && <small>Solo anfitrión</small>}</div>
        <label>Categorías</label>
        <div className="category-list">{CATEGORIES.map((category) => <button key={category} disabled={!isHost} className={state.settings.categories.includes(category) ? 'selected' : ''} onClick={() => toggleCategory(category)}>{category}{state.settings.categories.includes(category) && <Check />}</button>)}</div>
        <div className="rules"><span><b>{state.players.length >= 13 ? 2 : 1}</b> impostor{state.players.length >= 13 ? 'es' : ''}</span><span><b>{state.settings.clueSeconds}s</b> pistas</span><span><b>{state.settings.voteSeconds}s</b> voto</span></div>
        {isHost ? <button className="button button--primary button--full start-button" disabled={!enough} onClick={() => send({ type: 'start_game' })}><Gamepad2 /> {enough ? 'Empezar partida' : `Faltan ${10 - state.players.length} jugadores`}</button> : <div className="waiting"><span className="spinner" /> Esperando al anfitrión…</div>}
      </Panel>
    </div>
  </div>;
}

type ScreenProps = { state: GameState; send: (message: Record<string, unknown>) => void };

function Reveal({ state, send }: ScreenProps) {
  const [revealed, setRevealed] = useState(false);
  const impostor = state.self?.role === 'impostor';
  return <div className="screen centered-stage">
    <div className="stage-heading"><span className="eyebrow"><Eye size={15} /> Identidad privada</span><h1>Descubre tu rol</h1><p>Que nadie vea tu pantalla. Mantén pulsada la tarjeta.</p></div>
    <div className={`role-card ${revealed ? 'role-card--revealed' : ''} ${impostor ? 'role-card--impostor' : ''}`}
      onPointerDown={() => setRevealed(true)} onPointerUp={() => setRevealed(false)} onPointerLeave={() => setRevealed(false)}>
      <div className="role-card__back"><EyeOff /><h2>Mantén pulsado</h2><p>para revelar tu identidad</p><div className="fingerprint">◎</div></div>
      <div className="role-card__front">
        <span className="role-icon">{impostor ? '🕵️' : '🛡️'}</span>
        <span className="overline">Tu identidad</span>
        <h2>{impostor ? 'ERES IMPOSTOR' : 'ERES CIUDADANO'}</h2>
        {impostor ? <p>Engaña al grupo y descubre la palabra sin ser expulsado.</p> : <><p>La palabra secreta es</p><strong>{state.self?.word}</strong><small>Categoría: {state.category}</small></>}
      </div>
    </div>
    <button className="button button--primary" disabled={state.self?.ready} onClick={() => send({ type: 'ready' })}>{state.self?.ready ? <><Check /> Estoy listo</> : <><Shield /> Ya conozco mi rol</>}</button>
    <p className="ready-count">{state.players.filter((player) => player.hasClue).length ? '' : `${state.players.filter((player) => player.connected).length} conectados`} · La ronda empezará al estar todos listos</p>
    {state.self?.id === state.hostId && <button className="text-button" onClick={() => send({ type: 'advance' })}>Empezar sin esperar</button>}
  </div>;
}

function Clues({ state, send }: ScreenProps) {
  const [clue, setClue] = useState('');
  const alive = state.players.find((player) => player.id === state.self?.id)?.alive;
  function submit(event: FormEvent) { event.preventDefault(); if (clue.trim()) send({ type: 'submit_clue', clue }); }
  return <div className="screen play-grid">
    <Panel className="play-main">
      <div className="phase-title"><div><span className="eyebrow"><MessageCircle size={15} /> Fase de pistas</span><h1>Una pista. Nada más.</h1><p>Demuestra que conoces la palabra sin hacerla demasiado obvia.</p></div><Timer deadline={state.deadline} /></div>
      {alive ? <form className="clue-form" onSubmit={submit}>
        {state.self?.role === 'citizen' ? <div className="secret-chip">Tu palabra: <strong>{state.self.word}</strong><Eye size={15} /></div> : <div className="secret-chip secret-chip--danger">Eres impostor · Improvisa bien</div>}
        <div className="input-action"><input value={clue} onChange={(event) => setClue(event.target.value)} placeholder="Escribe una pista breve…" maxLength={60} disabled={state.self?.hasClue} /><button className="button button--primary" disabled={state.self?.hasClue || clue.trim().length < 2}>{state.self?.hasClue ? <Check /> : <Send />}{state.self?.hasClue ? 'Enviada' : 'Enviar'}</button></div>
        <span className="char-count">{clue.length}/60</span>
      </form> : <div className="spectator-note"><UserRoundX /> Estás expulsado. Observa cómo sigue la partida.</div>}
      <div className="clues-wall">
        <div className="section-title"><h2>Pistas del grupo</h2><span>{state.clues.length}/{state.players.filter((player) => player.alive).length}</span></div>
        {state.clues.length ? state.clues.map((entry) => { const player = state.players.find((item) => item.id === entry.playerId)!; return <div className="clue-row pop-in" key={entry.playerId}><Avatar player={player} small /><b>{player.alias}</b><q>{entry.clue}</q><Check /></div>; }) : <div className="blank-state">Las pistas aparecerán aquí en tiempo real.</div>}
      </div>
      {state.self?.id === state.hostId && <button className="text-button" onClick={() => send({ type: 'advance' })}>Cerrar pistas y votar</button>}
    </Panel>
    <SidePlayers state={state} />
  </div>;
}

function Voting({ state, send }: ScreenProps) {
  const [selected, setSelected] = useState('');
  const self = state.players.find((player) => player.id === state.self?.id);
  const candidates = state.players.filter((player) => player.alive && player.id !== state.self?.id);
  return <div className="screen play-grid">
    <Panel className="play-main">
      <div className="phase-title"><div><span className="eyebrow"><Vote size={15} /> Votación secreta</span><h1>¿Quién está mintiendo?</h1><p>Tu elección será invisible hasta que termine la votación.</p></div><Timer deadline={state.deadline} /></div>
      {!self?.alive ? <div className="spectator-note"><UserRoundX /> Estás expulsado. Espera el resultado.</div> : state.self?.hasVoted ? <div className="vote-locked"><Check /><h2>Voto registrado</h2><p>Nadie sabrá a quién has votado hasta el recuento.</p></div> : <>
        <div className="vote-grid">{candidates.map((player) => <button key={player.id} className={selected === player.id ? 'selected' : ''} onClick={() => setSelected(player.id)}><Avatar player={player} /><span>{player.alias}</span>{selected === player.id && <Check />}</button>)}</div>
        <button className="button button--danger button--vote" disabled={!selected} onClick={() => send({ type: 'vote', targetId: selected })}><Vote /> Confirmar voto</button>
      </>}
      <div className="vote-progress"><div><span style={{ width: `${(state.players.filter((player) => player.hasVoted).length / Math.max(1, state.players.filter((player) => player.alive).length)) * 100}%` }} /></div><p>{state.players.filter((player) => player.hasVoted).length} de {state.players.filter((player) => player.alive).length} votos recibidos</p></div>
      {state.self?.id === state.hostId && <button className="text-button" onClick={() => send({ type: 'advance' })}>Cerrar votación ahora</button>}
    </Panel>
    <SidePlayers state={state} />
  </div>;
}

function Result({ state, send }: ScreenProps) {
  const result = state.voteResult;
  const eliminated = state.players.find((player) => player.id === result?.eliminatedId);
  return <div className="screen centered-stage result-stage">
    <span className="eyebrow"><Vote size={15} /> Resultado de la ronda {state.round}</span>
    {result?.tied || !eliminated ? <><div className="result-orb result-orb--tie">⚖️</div><h1>Empate. Nadie sale.</h1><p>La tripulación no ha llegado a un veredicto.</p></> : <><div className={`result-orb ${result.wasImpostor ? 'result-orb--win' : 'result-orb--danger'}`}><Avatar player={eliminated} /></div><h1>{eliminated.alias} ha sido expulsado</h1><p className="big-reveal">Era <strong>{result.wasImpostor ? 'IMPOSTOR' : 'CIUDADANO'}</strong></p></>}
    <div className="count-grid">{Object.entries(result?.counts ?? {}).sort((a, b) => b[1] - a[1]).map(([id, count]) => { const player = state.players.find((item) => item.id === id); return player && <span key={id}>{player.alias}<b>{count} voto{count === 1 ? '' : 's'}</b></span>; })}</div>
    {state.winner ? <p className="next-note">La partida ha terminado. Preparando resultado final…</p> : <p className="next-note">Siguiente ronda en <Timer deadline={state.deadline} /></p>}
    {state.self?.id === state.hostId && <button className="button button--ghost" onClick={() => send({ type: 'advance' })}>Continuar <ArrowRight /></button>}
  </div>;
}

function Finished({ state, send }: ScreenProps) {
  const citizensWin = state.winner === 'citizens';
  const ranking = [...state.players].sort((a, b) => b.score - a.score);
  return <div className="screen finish-stage">
    <div className="confetti" aria-hidden="true">{Array.from({ length: 18 }).map((_, index) => <i key={index} />)}</div>
    <span className="eyebrow"><Trophy size={15} /> Fin de la partida</span>
    <div className={`winner-icon ${citizensWin ? 'winner-icon--citizen' : ''}`}>{citizensWin ? '🛡️' : '🕵️'}</div>
    <h1>¡Ganan los {citizensWin ? 'ciudadanos' : 'impostores'}!</h1>
    <p>{citizensWin ? 'La tripulación descubrió a todos los infiltrados.' : 'Los infiltrados sobrevivieron y tomaron el control.'}</p>
    <Panel className="final-ranking">
      <div className="section-title"><h2><Medal /> Ranking de la partida</h2><span>Ronda {state.round}</span></div>
      {ranking.map((player, index) => <div className="rank-row" key={player.id}><b className={`rank rank--${index + 1}`}>#{index + 1}</b><Avatar player={player} small /><span>{player.alias}<small>{player.revealedRole === 'impostor' ? 'Impostor' : 'Ciudadano'}</small></span><strong>{player.score + (((player.revealedRole === 'citizen' && citizensWin) || (player.revealedRole === 'impostor' && !citizensWin)) ? 10 : 0)} pts</strong></div>)}
    </Panel>
    <div className="finish-actions">{state.self?.id === state.hostId && <button className="button button--primary" onClick={() => send({ type: 'play_again' })}><RotateCcw /> Jugar otra vez</button>}<button className="button button--whatsapp" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`🕵️ Hemos jugado a Impostor Party. ¿Te unes a la próxima? ${window.location.origin}`)}`, '_blank')}><MessageCircle /> Compartir</button></div>
  </div>;
}

function SidePlayers({ state }: { state: GameState }) {
  return <Panel className="side-players"><div className="section-title"><h2><Users /> Jugadores</h2><span>{state.players.filter((player) => player.alive).length} vivos</span></div>{state.players.map((player) => <div className={`side-player ${!player.alive ? 'side-player--out' : ''}`} key={player.id}><Avatar player={player} small /><span>{player.alias}{player.id === state.self?.id && <small>Tú</small>}</span>{!player.alive ? <UserRoundX /> : player.hasClue ? <Check /> : <i />}</div>)}</Panel>;
}

function Game({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const [state, setState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const socket = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);

  useEffect(() => {
    let stopped = false;
    let attempts = 0;
    const connect = async () => {
      try {
        if (!state) setState(await getSnapshot(session));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'No se pudo recuperar la sala.');
      }
      if (stopped) return;
      const ws = new WebSocket(socketUrl(session));
      socket.current = ws;
      ws.onopen = () => { attempts = 0; setConnected(true); setError(''); };
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data) as { type: string; state?: GameState; error?: string };
        if (message.type === 'snapshot' && message.state) setState(message.state);
        if (message.type === 'error') setError(message.error ?? 'Operación no válida.');
      };
      ws.onclose = (event) => {
        setConnected(false);
        if (event.code === 4001) { setError('El anfitrión te ha expulsado de la sala.'); return; }
        if (!stopped) reconnectTimer.current = window.setTimeout(connect, Math.min(8000, 800 * 2 ** attempts++));
      };
      ws.onerror = () => ws.close();
    };
    void connect();
    return () => { stopped = true; if (reconnectTimer.current) clearTimeout(reconnectTimer.current); socket.current?.close(); };
    // session identifica de forma estable toda la conexión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.code, session.playerId, session.token]);

  const send = useCallback((message: Record<string, unknown>) => {
    setError('');
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message));
    else setError('Reconectando. Inténtalo en unos segundos.');
  }, []);

  if (!state) return <main className="loading-screen"><Logo /><span className="spinner spinner--large" /><p>{error || 'Conectando con la sala…'}</p>{error && <button className="button button--ghost" onClick={onLeave}>Volver al inicio</button>}</main>;

  return <main className="game-shell">
    <ProgressHeader state={state} connected={connected} />
    {error && <div className="toast" role="alert"><span>{error}</span><button onClick={() => setError('')}><X /></button></div>}
    {state.phase === 'lobby' && <Lobby state={state} send={send} onLeave={onLeave} />}
    {state.phase === 'reveal' && <Reveal state={state} send={send} />}
    {state.phase === 'clues' && <Clues state={state} send={send} />}
    {state.phase === 'voting' && <Voting state={state} send={send} />}
    {state.phase === 'result' && <Result state={state} send={send} />}
    {state.phase === 'finished' && <Finished state={state} send={send} />}
  </main>;
}

function pathCode() {
  return window.location.pathname.match(/^\/(?:join|room)\/([A-Z0-9]{6})/i)?.[1]?.toUpperCase() ?? '';
}

export default function App() {
  const codeFromUrl = useMemo(pathCode, []);
  const [session, setSession] = useState<Session | null>(() => {
    if (!codeFromUrl) return null;
    try { return JSON.parse(localStorage.getItem(`impostor-session:${codeFromUrl}`) ?? 'null') as Session | null; } catch { return null; }
  });

  function startSession(next: Session) {
    localStorage.setItem(`impostor-session:${next.code}`, JSON.stringify(next));
    window.history.replaceState({}, '', `/room/${next.code}`);
    setSession(next);
  }
  function leave() {
    if (session) localStorage.removeItem(`impostor-session:${session.code}`);
    window.history.replaceState({}, '', '/');
    setSession(null);
  }

  return session ? <Game session={session} onLeave={leave} /> : <Home initialCode={codeFromUrl} onSession={startSession} />;
}
