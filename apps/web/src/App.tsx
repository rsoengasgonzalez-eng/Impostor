import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from 'react';
import {
  createRoom,
  getCategories,
  getLeaderboard,
  getSnapshot,
  joinRoom,
  openRoomSocket,
  type ClientAction,
  type LeaderboardEntry,
  type RoomState,
  type ServerMessage,
  type Session,
} from './api';

const SESSION_KEY = 'impostor-party-session';

const styles = `
  :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; min-width: 320px; min-height: 100vh; background: #090b16; color: #f8f8ff; }
  button, input { font: inherit; }
  button { cursor: pointer; }
  .app { min-height: 100vh; position: relative; overflow: hidden; background: radial-gradient(circle at 20% 0%, rgba(139,92,246,.22), transparent 34%), radial-gradient(circle at 100% 30%, rgba(34,211,238,.13), transparent 30%), #090b16; }
  .app::before { content: ""; position: fixed; inset: 0; pointer-events: none; opacity: .24; background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px); background-size: 32px 32px; mask-image: linear-gradient(to bottom, black, transparent 85%); }
  .shell { width: min(1080px, calc(100% - 28px)); margin: 0 auto; padding: 26px 0 64px; position: relative; z-index: 1; }
  .topbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 28px; }
  .brand { display: flex; align-items: center; gap: 12px; font-weight: 900; letter-spacing: .12em; }
  .brand-mark { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 15px; background: linear-gradient(135deg, #8b5cf6, #ec4899); box-shadow: 0 12px 35px rgba(139,92,246,.35); font-size: 23px; }
  .brand small { display: block; margin-top: 2px; color: #9aa0b8; font-size: 10px; letter-spacing: .18em; }
  .hero { text-align: center; padding: 36px 10px 24px; }
  .eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px; border: 1px solid rgba(167,139,250,.35); border-radius: 999px; color: #c4b5fd; background: rgba(139,92,246,.1); font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 18px 0 12px; font-size: clamp(42px, 9vw, 78px); line-height: .95; letter-spacing: -.055em; }
  h1 span { background: linear-gradient(90deg, #c4b5fd, #f0abfc, #67e8f9); -webkit-background-clip: text; color: transparent; }
  .hero p { max-width: 650px; margin: 0 auto; color: #aeb3c7; font-size: clamp(16px, 2vw, 19px); line-height: 1.65; }
  .grid { display: grid; grid-template-columns: 1.08fr .92fr; gap: 18px; align-items: start; }
  .card { border: 1px solid rgba(255,255,255,.09); border-radius: 24px; background: rgba(17,20,38,.78); box-shadow: 0 24px 80px rgba(0,0,0,.28); backdrop-filter: blur(18px); padding: 24px; }
  .card h2, .card h3 { margin: 0 0 8px; }
  .card-copy { color: #9399b1; margin: 0 0 20px; line-height: 1.55; }
  .stack { display: grid; gap: 14px; }
  label { display: grid; gap: 7px; color: #d9dbea; font-size: 13px; font-weight: 800; }
  input { width: 100%; color: white; background: #0b0e1d; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; padding: 14px 15px; outline: none; transition: .2s ease; }
  input:focus { border-color: #8b5cf6; box-shadow: 0 0 0 4px rgba(139,92,246,.14); }
  .code-input { text-transform: uppercase; letter-spacing: .24em; font-weight: 900; }
  .row { display: flex; gap: 10px; align-items: center; }
  .row > * { flex: 1; }
  .btn { border: 0; border-radius: 14px; min-height: 48px; padding: 12px 17px; color: white; background: #262a43; font-weight: 900; transition: transform .18s ease, opacity .18s ease, box-shadow .18s ease; }
  .btn:hover:not(:disabled) { transform: translateY(-2px); }
  .btn:disabled { cursor: not-allowed; opacity: .42; }
  .btn-primary { background: linear-gradient(135deg, #7c3aed, #db2777); box-shadow: 0 12px 28px rgba(124,58,237,.28); }
  .btn-cyan { background: linear-gradient(135deg, #0891b2, #2563eb); }
  .btn-whatsapp { background: linear-gradient(135deg, #16a34a, #22c55e); }
  .btn-ghost { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.09); }
  .btn-danger { background: rgba(239,68,68,.15); color: #fca5a5; border: 1px solid rgba(239,68,68,.25); }
  .divider { height: 1px; margin: 20px 0; background: rgba(255,255,255,.08); }
  .feature-list { display: grid; gap: 12px; }
  .feature { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border-radius: 16px; background: rgba(255,255,255,.035); }
  .feature strong { display: block; margin-bottom: 3px; }
  .feature span { color: #8f95ad; font-size: 13px; line-height: 1.45; }
  .error { margin: 0 0 16px; padding: 12px 14px; border-radius: 14px; color: #fecaca; background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.22); }
  .notice { padding: 12px 14px; border-radius: 14px; color: #bae6fd; background: rgba(14,165,233,.1); border: 1px solid rgba(14,165,233,.2); }
  .leaderboard { display: grid; gap: 8px; }
  .rank { display: grid; grid-template-columns: 32px 1fr auto; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 13px; background: rgba(255,255,255,.035); }
  .rank small { color: #979db5; }
  .room-head { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin-bottom: 18px; }
  .room-code { font-size: clamp(30px, 7vw, 54px); letter-spacing: .18em; font-weight: 950; line-height: 1; }
  .muted { color: #949ab2; }
  .phase { display: inline-flex; align-items: center; gap: 7px; padding: 7px 11px; border-radius: 999px; background: rgba(139,92,246,.14); color: #d8b4fe; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; box-shadow: 0 0 12px currentColor; }
  .status-dot.online { background: #22c55e; }
  .room-grid { display: grid; grid-template-columns: minmax(0, 1fr) 310px; gap: 18px; align-items: start; }
  .players { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
  .player { display: flex; align-items: center; gap: 10px; min-height: 62px; padding: 10px 12px; border-radius: 16px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06); }
  .player.dead { opacity: .5; filter: grayscale(.7); }
  .avatar { width: 38px; height: 38px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 13px; background: linear-gradient(135deg, #312e81, #7e22ce); font-weight: 950; }
  .player-name { min-width: 0; flex: 1; }
  .player-name strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .player-name small { color: #858ba3; }
  .connection { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 50%; background: #52576d; }
  .connection.on { background: #22c55e; box-shadow: 0 0 10px rgba(34,197,94,.8); }
  .kick { flex: 0 0 auto; width: 29px; height: 29px; min-height: 0; padding: 0; border-radius: 9px; }
  .timer { display: grid; place-items: center; width: 76px; height: 76px; border-radius: 50%; background: conic-gradient(#8b5cf6 var(--progress, 60%), rgba(255,255,255,.07) 0); position: relative; font-size: 20px; font-weight: 950; }
  .timer::after { content: ""; position: absolute; inset: 6px; border-radius: inherit; background: #111426; }
  .timer span { position: relative; z-index: 1; }
  .stage { text-align: center; padding: 30px 22px; }
  .stage-icon { font-size: 52px; margin-bottom: 8px; }
  .stage h2 { font-size: clamp(27px, 5vw, 43px); margin-bottom: 10px; }
  .role-card { max-width: 520px; margin: 24px auto; padding: 28px; border-radius: 24px; border: 1px solid rgba(255,255,255,.12); background: linear-gradient(150deg, rgba(124,58,237,.22), rgba(236,72,153,.08)); }
  .role-card.impostor { background: linear-gradient(150deg, rgba(220,38,38,.25), rgba(124,45,18,.12)); }
  .secret { margin-top: 15px; padding: 15px; border-radius: 16px; background: #090b16; }
  .secret strong { display: block; font-size: clamp(25px, 6vw, 38px); color: #c4b5fd; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { flex: 0 0 auto; min-height: 36px; border-radius: 999px; padding: 8px 12px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); color: #a7abc0; font-size: 12px; font-weight: 800; }
  .chip.active { color: white; border-color: #8b5cf6; background: rgba(139,92,246,.2); }
  .clues { display: grid; gap: 9px; margin: 18px 0; text-align: left; }
  .clue { display: grid; grid-template-columns: minmax(100px, .45fr) 1fr; gap: 12px; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,.04); }
  .clue strong { color: #c4b5fd; }
  .vote-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 18px; }
  .vote-btn { min-height: 74px; display: flex; align-items: center; gap: 10px; text-align: left; }
  .result-box { max-width: 580px; margin: 20px auto; padding: 20px; border-radius: 20px; background: rgba(255,255,255,.045); }
  .winner { font-size: clamp(30px, 7vw, 55px); background: linear-gradient(90deg, #fde68a, #f0abfc); -webkit-background-clip: text; color: transparent; }
  .footer-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 22px; }
  @media (max-width: 820px) { .grid, .room-grid { grid-template-columns: 1fr; } .room-grid aside { order: -1; } }
  @media (max-width: 560px) { .shell { width: min(100% - 18px, 1080px); padding-top: 14px; } .topbar { align-items: flex-start; } .card { border-radius: 20px; padding: 18px; } .row { flex-direction: column; align-items: stretch; } .room-head { align-items: center; } .room-code { letter-spacing: .1em; } .timer { width: 64px; height: 64px; } .clue { grid-template-columns: 1fr; gap: 4px; } }
`;

const phaseNames: Record<RoomState['phase'], string> = {
  lobby: 'Sala de espera',
  reveal: 'Tu identidad',
  clues: 'Ronda de pistas',
  voting: 'Votación',
  result: 'Resultado',
  finished: 'Fin de partida',
};

function readStoredSession(): Session | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<Session>;
    return parsed.code && parsed.playerId && parsed.token
      ? { code: parsed.code, playerId: parsed.playerId, token: parsed.token }
      : null;
  } catch {
    return null;
  }
}

function codeFromLocation(): string {
  const match = window.location.pathname.match(/^\/join\/([A-Z0-9]{6})\/?$/i);
  return match?.[1]?.toUpperCase() ?? '';
}

function initials(alias: string): string {
  return alias.trim().slice(0, 2).toUpperCase();
}

export default function App() {
  const [alias, setAlias] = useState('');
  const [roomCode, setRoomCode] = useState(codeFromLocation);
  const [session, setSession] = useState<Session | null>(readStoredSession);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [clue, setClue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(Date.now());
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    void getCategories().then(setAvailableCategories).catch(() => setAvailableCategories([]));
    if (session) return;
    void getLeaderboard(8).then(setLeaderboard).catch(() => setLeaderboard([]));
  }, [session]);

  useEffect(() => {
    if (!session) return;

    let stopped = false;
    let retryTimer: number | undefined;
    let attempt = 0;

    const connect = () => {
      if (stopped) return;
      const socket = openRoomSocket(session);
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        attempt = 0;
        setConnected(true);
        setError('');
      });

      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(String(event.data)) as ServerMessage;
          if (message.type === 'snapshot') setRoom(message.state);
          if (message.type === 'error') setError(message.error);
        } catch {
          setError('Se recibió un mensaje no válido del servidor.');
        }
      });

      socket.addEventListener('close', (event) => {
        if (socketRef.current === socket) socketRef.current = null;
        setConnected(false);
        if (stopped) return;
        if (event.code === 4001) {
          setError('El anfitrión te ha expulsado de la sala.');
          return;
        }
        const delay = Math.min(10_000, 800 * 2 ** attempt);
        attempt += 1;
        retryTimer = window.setTimeout(connect, delay);
      });

      socket.addEventListener('error', () => socket.close());
    };

    void getSnapshot(session).then((snapshot) => {
      if (!stopped) setRoom(snapshot);
    }).catch((snapshotError: unknown) => {
      if (!stopped) setError(snapshotError instanceof Error ? snapshotError.message : 'No se pudo recuperar la sala.');
    });

    connect();

    return () => {
      stopped = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      socketRef.current?.close(1000, 'Cambio de sala');
      socketRef.current = null;
    };
  }, [session]);

  useEffect(() => {
    if (!room?.deadline) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [room?.deadline]);

  const secondsLeft = room?.deadline ? Math.max(0, Math.ceil((room.deadline - now) / 1000)) : null;
  const selfPlayer = useMemo(
    () => room?.players.find((player) => player.id === session?.playerId) ?? null,
    [room?.players, session?.playerId],
  );
  const isHost = Boolean(room && session && room.hostId === session.playerId);

  function saveSession(nextSession: Session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
    setRoomCode(nextSession.code);
    window.history.replaceState(null, '', `/join/${nextSession.code}`);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      saveSession(await createRoom(alias));
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear la sala.');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      saveSession(await joinRoom(roomCode, alias));
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'No se pudo entrar en la sala.');
    } finally {
      setBusy(false);
    }
  }

  function leaveRoom() {
    socketRef.current?.close(1000, 'Salir');
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setRoom(null);
    setConnected(false);
    setError('');
    window.history.replaceState(null, '', '/');
  }

  function send(action: ClientAction) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError('Reconectando con la sala. Inténtalo de nuevo en unos segundos.');
      return;
    }
    setError('');
    socket.send(JSON.stringify(action));
  }

  function invitationLink(): string {
    return `${window.location.origin}/join/${room?.code ?? session?.code ?? roomCode}`;
  }

  function shareWhatsApp() {
    const text = `🕵️ ¿Quién es el impostor? Únete a mi partida con el código ${room?.code ?? session?.code ?? roomCode}:\n${invitationLink()}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(invitationLink());
      setError('');
    } catch {
      setError('No se pudo copiar el enlace. Puedes copiarlo desde la barra del navegador.');
    }
  }

  function renderHome() {
    return (
      <>
        <section className="hero">
          <div className="eyebrow">⚡ De 10 a 15 jugadores · En tiempo real</div>
          <h1>ENCUENTRA AL <span>IMPOSTOR</span></h1>
          <p>Comparte la sala por WhatsApp, da una pista sin revelar la palabra y descubre quién está fingiendo antes de que sea demasiado tarde.</p>
        </section>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="grid">
          <section className="card">
            <h2>Crear una partida</h2>
            <p className="card-copy">Serás el anfitrión. La partida podrá comenzar cuando seáis al menos 10.</p>
            <form className="stack" onSubmit={handleCreate}>
              <label>
                Tu alias
                <input value={alias} onChange={(event: ChangeEvent<HTMLInputElement>) => setAlias(event.target.value)} minLength={2} maxLength={24} placeholder="Ej. Detective Roi" required autoComplete="nickname" />
              </label>
              <button className="btn btn-primary" disabled={busy || alias.trim().length < 2}>🎮 {busy ? 'Creando…' : 'Crear sala'}</button>
            </form>

            <div className="divider" />

            <h3>Entrar con un código</h3>
            <form className="stack" onSubmit={handleJoin}>
              <label>
                Código de 6 caracteres
                <input className="code-input" value={roomCode} onChange={(event: ChangeEvent<HTMLInputElement>) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} minLength={6} maxLength={6} placeholder="ABC123" required />
              </label>
              <label>
                Tu alias
                <input value={alias} onChange={(event: ChangeEvent<HTMLInputElement>) => setAlias(event.target.value)} minLength={2} maxLength={24} placeholder="Tu nombre en la partida" required autoComplete="nickname" />
              </label>
              <button className="btn btn-cyan" disabled={busy || roomCode.length !== 6 || alias.trim().length < 2}>🚪 {busy ? 'Entrando…' : 'Entrar en la sala'}</button>
            </form>
          </section>

          <aside className="card">
            <h3>Cómo se juega</h3>
            <p className="card-copy">Una partida social rápida, pensada para jugar desde el móvil.</p>
            <div className="feature-list">
              <div className="feature"><b>1️⃣</b><div><strong>Reúne al grupo</strong><span>Crea la sala y comparte el enlace por WhatsApp.</span></div></div>
              <div className="feature"><b>🤫</b><div><strong>Mira tu rol</strong><span>Los ciudadanos conocen la palabra; el impostor debe disimular.</span></div></div>
              <div className="feature"><b>💬</b><div><strong>Da una pista</strong><span>Ayuda al grupo sin hacer la respuesta demasiado obvia.</span></div></div>
              <div className="feature"><b>🗳️</b><div><strong>Vota</strong><span>Expulsad al sospechoso antes de que los impostores dominen.</span></div></div>
            </div>

            {leaderboard.length > 0 && (
              <>
                <div className="divider" />
                <h3>🏆 Clasificación</h3>
                <div className="leaderboard">
                  {leaderboard.map((entry, index) => (
                    <div className="rank" key={`${entry.alias}-${index}`}>
                      <b>{index + 1}</b>
                      <span>{entry.alias}<small> · {entry.wins} victorias</small></span>
                      <strong>{entry.score} pts</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
      </>
    );
  }

  function renderPlayers() {
    if (!room) return null;
    return (
      <div className="players">
        {room.players.map((player) => (
          <div className={`player ${player.alive ? '' : 'dead'}`} key={player.id}>
            <div className="avatar">{initials(player.alias)}</div>
            <div className="player-name">
              <strong>{player.alias} {player.isHost ? '👑' : ''}</strong>
              <small>{!player.alive ? `Expulsado${player.revealedRole ? ` · ${player.revealedRole === 'impostor' ? 'Impostor' : 'Ciudadano'}` : ''}` : `${player.score} puntos`}</small>
            </div>
            <span className={`connection ${player.connected ? 'on' : ''}`} title={player.connected ? 'Conectado' : 'Desconectado'} />
            {isHost && room.phase === 'lobby' && !player.isHost && (
              <button className="btn btn-danger kick" onClick={() => send({ type: 'kick', targetId: player.id })} title={`Expulsar a ${player.alias}`}>×</button>
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderLobby() {
    if (!room) return null;
    const enoughPlayers = room.players.length >= 10;
    const toggleCategory = (category: string) => {
      if (!isHost) return;
      const categories = room.settings.categories.includes(category)
        ? room.settings.categories.filter((item) => item !== category)
        : [...room.settings.categories, category];
      if (categories.length > 0) send({ type: 'update_settings', settings: { categories } });
    };

    return (
      <div className="room-grid">
        <section className="card">
          <h2>Jugadores <span className="muted">{room.players.length}/15</span></h2>
          <p className="card-copy">Se necesitan entre 10 y 15 personas. Con 13 o más habrá dos impostores.</p>
          {renderPlayers()}
        </section>
        <aside className="card stack">
          <div>
            <h3>Invita al grupo</h3>
            <p className="card-copy">Código: <strong>{room.code}</strong></p>
            <div className="stack">
              <button className="btn btn-whatsapp" onClick={shareWhatsApp}>💬 Compartir por WhatsApp</button>
              <button className="btn btn-ghost" onClick={() => void copyInvitation()}>🔗 Copiar enlace</button>
            </div>
          </div>
          {isHost && (
            <>
              <div className="divider" />
              <div>
                <h3>Categorías</h3>
                <p className="card-copy">Pulsa para activar o desactivar.</p>
                <div className="chips">
                  {(availableCategories.length > 0 ? availableCategories : room.settings.categories).map((category) => {
                    const active = room.settings.categories.includes(category);
                    return (
                      <button
                        className={`chip ${active ? 'active' : ''}`}
                        key={category}
                        onClick={() => toggleCategory(category)}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button className="btn btn-primary" disabled={!enoughPlayers} onClick={() => send({ type: 'start_game' })}>
                {enoughPlayers ? '🚀 Empezar partida' : `Faltan ${10 - room.players.length} jugadores`}
              </button>
            </>
          )}
          {!isHost && <p className="notice">Esperando a que el anfitrión inicie la partida.</p>}
        </aside>
      </div>
    );
  }

  function renderReveal() {
    if (!room?.self) return null;
    const impostor = room.self.role === 'impostor';
    return (
      <section className="card stage">
        <div className="stage-icon">{impostor ? '🕵️' : '🧑‍🚀'}</div>
        <h2>{impostor ? 'ERES EL IMPOSTOR' : 'ERES CIUDADANO'}</h2>
        <p className="card-copy">No enseñes esta pantalla. Memoriza tu información y pulsa listo.</p>
        <div className={`role-card ${impostor ? 'impostor' : ''}`}>
          <p className="muted">Categoría</p>
          <h3>{room.category ?? 'Secreta'}</h3>
          <div className="secret">
            <span className="muted">{impostor ? 'Tu misión' : 'La palabra secreta'}</span>
            <strong>{impostor ? 'Finge y sobrevive' : room.self.word ?? '••••••'}</strong>
          </div>
        </div>
        <button className="btn btn-primary" disabled={room.self.ready} onClick={() => send({ type: 'ready' })}>
          {room.self.ready ? '✓ Estás listo' : 'He memorizado mi rol'}
        </button>
        {isHost && <button className="btn btn-ghost" onClick={() => send({ type: 'advance' })}>Avanzar ahora</button>}
      </section>
    );
  }

  function renderClues() {
    if (!room?.self) return null;
    const canSubmit = Boolean(selfPlayer?.alive && !room.self.hasClue);
    return (
      <section className="card stage">
        <div className="stage-icon">💬</div>
        <h2>Da una pista</h2>
        <p className="card-copy">Ronda {room.round}. No digas la palabra secreta ni una parte de ella.</p>
        {room.clues.length > 0 && (
          <div className="clues">
            {room.clues.map((item) => (
              <div className="clue" key={item.playerId}>
                <strong>{room.players.find((player) => player.id === item.playerId)?.alias ?? 'Jugador'}</strong>
                <span>{item.clue}</span>
              </div>
            ))}
          </div>
        )}
        {canSubmit && (
          <form className="row" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); send({ type: 'submit_clue', clue }); setClue(''); }}>
            <input value={clue} onChange={(event: ChangeEvent<HTMLInputElement>) => setClue(event.target.value)} minLength={2} maxLength={60} placeholder="Escribe una pista breve…" required autoFocus />
            <button className="btn btn-primary" disabled={clue.trim().length < 2}>Enviar pista</button>
          </form>
        )}
        {room.self.hasClue && <p className="notice">✓ Pista enviada. Esperando al resto del grupo.</p>}
        {!selfPlayer?.alive && <p className="notice">Estás expulsado; puedes seguir la partida como espectador.</p>}
        {isHost && <div className="footer-actions"><button className="btn btn-ghost" onClick={() => send({ type: 'advance' })}>Abrir votación</button></div>}
      </section>
    );
  }

  function renderVoting() {
    if (!room?.self) return null;
    const canVote = Boolean(selfPlayer?.alive && !room.self.hasVoted);
    const candidates = room.players.filter((player) => player.alive && player.id !== room.self?.id);
    return (
      <section className="card stage">
        <div className="stage-icon">🗳️</div>
        <h2>¿Quién está fingiendo?</h2>
        <p className="card-copy">El voto es secreto y no se puede cambiar.</p>
        {canVote ? (
          <div className="vote-grid">
            {candidates.map((player) => (
              <button className="btn btn-ghost vote-btn" key={player.id} onClick={() => send({ type: 'vote', targetId: player.id })}>
                <span className="avatar">{initials(player.alias)}</span><strong>{player.alias}</strong>
              </button>
            ))}
          </div>
        ) : (
          <p className="notice">{room.self.hasVoted ? '✓ Voto registrado. Esperando al resto.' : 'Observa la votación como espectador.'}</p>
        )}
        {isHost && <div className="footer-actions"><button className="btn btn-ghost" onClick={() => send({ type: 'advance' })}>Cerrar votación</button></div>}
      </section>
    );
  }

  function renderResult() {
    if (!room) return null;
    const voteResult = room.voteResult;
    const eliminated = voteResult?.eliminatedId
      ? room.players.find((player) => player.id === voteResult.eliminatedId)
      : null;

    return (
      <section className="card stage">
        <div className="stage-icon">{voteResult?.tied ? '🤝' : voteResult?.wasImpostor ? '🎯' : '😬'}</div>
        <h2>{voteResult?.tied ? 'Empate' : eliminated ? `${eliminated.alias} ha sido expulsado` : 'Nadie ha sido expulsado'}</h2>
        <div className="result-box">
          {voteResult?.tied && <p>La votación ha terminado en empate.</p>}
          {!voteResult?.tied && eliminated && (
            <p><strong>{eliminated.alias}</strong> {voteResult?.wasImpostor ? 'sí era impostor.' : 'no era impostor.'}</p>
          )}
          {room.winner && <h3>{room.winner === 'citizens' ? '¡Ganan los ciudadanos!' : '¡Ganan los impostores!'}</h3>}
        </div>
        <p className="muted">La siguiente fase comenzará automáticamente.</p>
        {isHost && <button className="btn btn-primary" onClick={() => send({ type: 'advance' })}>Continuar</button>}
      </section>
    );
  }

  function renderFinished() {
    if (!room) return null;
    const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
    return (
      <section className="card stage">
        <div className="stage-icon">🏆</div>
        <h2 className="winner">{room.winner === 'citizens' ? 'GANAN LOS CIUDADANOS' : 'GANAN LOS IMPOSTORES'}</h2>
        <p className="card-copy">Estos eran los roles y la puntuación final.</p>
        <div className="players">
          {sortedPlayers.map((player) => (
            <div className="player" key={player.id}>
              <div className="avatar">{player.revealedRole === 'impostor' ? '🕵️' : '🧑‍🚀'}</div>
              <div className="player-name"><strong>{player.alias}</strong><small>{player.revealedRole === 'impostor' ? 'Impostor' : 'Ciudadano'}</small></div>
              <strong>{player.score} pts</strong>
            </div>
          ))}
        </div>
        <div className="footer-actions">
          {isHost && <button className="btn btn-primary" onClick={() => send({ type: 'play_again' })}>🔄 Jugar otra vez</button>}
          <button className="btn btn-whatsapp" onClick={shareWhatsApp}>💬 Compartir sala</button>
        </div>
      </section>
    );
  }

  function renderRoom() {
    if (!room) {
      return (
        <section className="card stage">
          <div className="stage-icon">📡</div>
          <h2>Conectando con la sala…</h2>
          <p className="card-copy">Recuperando la partida y abriendo el canal en tiempo real.</p>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn-ghost" onClick={leaveRoom}>Salir</button>
        </section>
      );
    }

    return (
      <>
        <div className="room-head">
          <div>
            <div className="phase"><span className={`status-dot ${connected ? 'online' : ''}`} />{phaseNames[room.phase]}</div>
            <div className="room-code">{room.code}</div>
            <span className="muted">Ronda {room.round || '—'} · {room.players.length} jugadores</span>
          </div>
          {secondsLeft !== null && <div className="timer" style={{ '--progress': `${Math.max(5, Math.min(100, secondsLeft * 2))}%` } as CSSProperties}><span>{secondsLeft}</span></div>}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {room.phase === 'lobby' && renderLobby()}
        {room.phase === 'reveal' && renderReveal()}
        {room.phase === 'clues' && renderClues()}
        {room.phase === 'voting' && renderVoting()}
        {room.phase === 'result' && renderResult()}
        {room.phase === 'finished' && renderFinished()}
      </>
    );
  }

  return (
    <div className="app">
      <style>{styles}</style>
      <main className="shell">
        <header className="topbar">
          <div className="brand"><span className="brand-mark">🕵️</span><span>IMPOSTOR<small>PARTY GAME</small></span></div>
          {session && <button className="btn btn-ghost" onClick={leaveRoom}>Salir</button>}
        </header>
        {session ? renderRoom() : renderHome()}
      </main>
    </div>
  );
}
