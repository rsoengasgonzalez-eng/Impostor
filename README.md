# 🕵️ Impostor Party

Juego web multijugador en tiempo real, en español y optimizado para móvil. Está diseñado para grupos de **10 a 15 personas**, se comparte con un enlace o código por WhatsApp y se despliega íntegramente en Cloudflare.

## Funcionalidades

- Salas privadas de 6 caracteres con acceso por enlace o código.
- 10–15 jugadores, alias únicos y anfitrión.
- 1 impostor con 10–12 jugadores; 2 impostores con 13–15.
- Asignación de roles y palabra secreta visibles solo para el jugador autenticado.
- 9 categorías y más de 100 palabras incluidas.
- Fases sincronizadas: sala, revelación, pistas, votación secreta, resultado y final.
- Temporizadores autoritativos en servidor mediante alarmas de Durable Objects.
- Reconexión automática por WebSocket y estado persistente de la sala.
- Expulsión, empates, condiciones de victoria y máximo de 8 rondas.
- Puntuación por detectar impostores, sobrevivir y ganar.
- Ranking global persistido en D1.
- Botón de invitación por WhatsApp, rutas `/join/CODIGO` y copia de enlace.
- Diseño responsive, accesible, animaciones, modo de movimiento reducido y UI oscura/neón.

## Arquitectura

```text
WhatsApp / navegador móvil
          │
          ▼
Cloudflare Pages (React + Vite)
          │ HTTPS / WebSocket
          ▼
Cloudflare Worker (API y CORS)
          │
          ├── Durable Object por código de sala
          │   ├── estado autoritativo
          │   ├── WebSockets hibernables
          │   └── alarmas de fase
          │
          └── Cloudflare D1
              ├── games
              └── leaderboard
```

La API nunca envía la palabra al impostor ni los roles de otros jugadores activos. Cada sesión utiliza un `playerId` y un token aleatorio privado. Las votaciones solo publican el recuento al cerrarse.

## Estructura

```text
impostor-party/
├── apps/
│   ├── web/                    # React, Vite, estilos y SPA
│   │   ├── public/             # _redirects y cabeceras para Pages
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── api.ts
│   │       ├── styles.css
│   │       └── types.ts
│   └── api/                    # Worker + Durable Object + D1
│       ├── migrations/
│       ├── src/
│       │   ├── index.ts
│       │   ├── logic.ts
│       │   └── words.ts
│       ├── test/
│       └── wrangler.jsonc
├── .github/workflows/ci.yml
├── package.json
└── README.md
```

## Desarrollo local

### Requisitos

- Node.js 20 o superior.
- Una cuenta de Cloudflare para el despliegue.

### Arranque

```bash
npm install
npm run db:migrate:local -w @impostor/api
npm run dev
```

Abre `http://localhost:5173`. Vite redirige `/api` y WebSockets a `http://localhost:8787`.

Para simular 10 jugadores, abre la URL en varias ventanas/perfiles o usa varios dispositivos de la misma red. Wrangler conserva localmente el estado del Durable Object y D1.

### Comprobaciones

```bash
npm run check
npm test
npm run build
```

## Despliegue en Cloudflare

### 1. Crear D1

```bash
npx wrangler login
npx wrangler d1 create impostor-db
```

Copia el `database_id` devuelto y sustituye `REPLACE_WITH_YOUR_D1_DATABASE_ID` en `apps/api/wrangler.jsonc`.

Aplica la migración:

```bash
npm run db:migrate:remote -w @impostor/api
```

### 2. Desplegar el Worker y Durable Object

```bash
npm run deploy:api
```

Guarda la URL resultante, por ejemplo `https://impostor-party-api.<tu-subdominio>.workers.dev`.

### 3. Configurar el frontend

Crea `apps/web/.env.production` (no se versiona) con:

```env
VITE_API_URL=https://impostor-party-api.<tu-subdominio>.workers.dev
```

Compila y despliega Pages:

```bash
npm run build -w @impostor/web
npx wrangler pages project create impostor-party
npm run deploy:web
```

También puedes conectar el repositorio desde el panel de Cloudflare Pages:

- **Directorio raíz:** `/`
- **Comando de compilación:** `npm install && npm run build -w @impostor/web`
- **Directorio de salida:** `apps/web/dist`
- **Variable:** `VITE_API_URL` con la URL pública del Worker.

### 4. Restringir CORS a Pages

Cambia `FRONTEND_URL` en `apps/api/wrangler.jsonc` por el dominio de Pages o tu dominio propio y vuelve a desplegar:

```jsonc
"vars": {
  "FRONTEND_URL": "https://impostor-party.pages.dev"
}
```

```bash
npm run deploy:api
```

### 5. GitHub

```bash
git init
git add .
git commit -m "feat: Impostor Party completo"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/impostor-party.git
git push -u origin main
```

El workflow incluido ejecuta tipos, tests y compilación en cada `push` y `pull_request`.

## Reglas y puntuación

1. El anfitrión inicia con 10–15 personas.
2. Todos descubren su rol de forma privada.
3. Los ciudadanos reciben la misma palabra; los impostores solo ven la categoría.
4. Cada jugador vivo envía una pista.
5. Cada jugador vivo vota en secreto a otro jugador.
6. El más votado es expulsado; en caso de empate no sale nadie.
7. Ciudadanos ganan al expulsar a todos los impostores.
8. Impostores ganan cuando igualan o superan a los ciudadanos vivos, o sobreviven 8 rondas.

Puntos durante la partida: `+2` por votar a un impostor, `+5` para cada ciudadano vivo cuando cae un impostor y `+3` para cada impostor que sobrevive una ronda. Ganar añade `+10` al ranking persistente.

## Operación y seguridad

- Las salas se aíslan en instancias de Durable Objects nombradas por el código.
- Los alias se validan y limitan a 20 caracteres; las pistas a 60.
- Los comandos se vuelven a validar en servidor (rol, fase, anfitrión y jugador vivo).
- Los tokens se guardan en `localStorage`; no deben compartirse ni registrarse en analítica.
- Para producción con mucho tráfico conviene añadir Turnstile y rate limiting a creación/unión.
- Las salas no se borran automáticamente en esta versión. Puede añadirse una alarma de retención si se necesita una política de caducidad.

## Personalización

- Palabras y categorías: `apps/api/src/words.ts`.
- Colores y UI: variables al principio de `apps/web/src/styles.css`.
- Duraciones y límites: `DEFAULT_SETTINGS` en `apps/api/src/index.ts`.
- Reglas puras y tests: `apps/api/src/logic.ts`.

## Licencia

MIT.
