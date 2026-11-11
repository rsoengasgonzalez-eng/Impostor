# Frontend corregido: Impostor Party

Copia estos dos archivos en el repositorio GitHub:

- `apps/web/src/api.ts`
- `apps/web/src/App.tsx`

## Qué se ha corregido

- `import.meta.env`: se tipa localmente, sin depender de un `vite-env.d.ts` adicional.
- `voteResult` posiblemente `undefined`: se estrecha el tipo con comprobaciones y encadenamiento opcional.
- URLs: no contienen etiquetas HTML, `<a>`, `<br>`, entidades `&lt;`/`&gt;` ni contenido del editor de chat.
- Se mantienen la API REST, el WebSocket con reconexión y el enlace de WhatsApp.
- El frontend usa `VITE_API_URL` en el build de Vite.

## Despliegue desde Cloudflare Pages, sin instalar nada local

1. Sube o reemplaza los dos archivos en GitHub y confirma los cambios en la rama `main`.
2. En Cloudflare abre **Workers & Pages**.
3. Selecciona **Create application** > **Pages** > **Connect to Git**.
4. Elige GitHub y el repositorio `rsoengasgonzalez-eng/Impostor`.
5. Configura:

   | Campo | Valor |
   |---|---|
   | Project name | `impostor-party-web` |
   | Production branch | `main` |
   | Framework preset | `React (Vite)` |
   | Root directory | `apps/web` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

6. En **Environment variables** añade:

   | Variable | Valor |
   |---|---|
   | `VITE_API_URL` | `https://impostor.rsoengasgonzalez.workers.dev` |
   | `NODE_VERSION` | `22` |

   No añadas una barra `/` al final de `VITE_API_URL`.

7. Pulsa **Save and Deploy**. Cloudflare instalará dependencias, ejecutará el build y publicará `dist`; no hace falta ejecutar nada en el ordenador.
8. Abre la URL `*.pages.dev`, crea una sala y comprueba el botón de WhatsApp.
9. Copia la URL de producción exacta de Pages.
10. En GitHub edita `apps/api/wrangler.jsonc` y cambia:

```json
"vars": {
  "FRONTEND_URL": "http://localhost:5173"
}
```

por:

```json
"vars": {
  "FRONTEND_URL": "https://TU-PROYECTO.pages.dev"
}
```

11. Confirma el cambio en `main`. El proyecto API conectado a Cloudflare se volverá a desplegar automáticamente.
12. Prueba de nuevo desde la URL de Pages. Si luego asignas un dominio propio, vuelve a cambiar `FRONTEND_URL` al origen exacto del dominio, sin ruta ni barra final.

## Importante

- Crea un proyecto **Pages**, no otro Worker. En Pages no debes introducir `npx wrangler deploy` como deploy command.
- Mantén el Worker API existente separado, con Root directory `apps/api`.
- No añadas un archivo `404.html` en la raíz del build: Cloudflare Pages tratará el proyecto como SPA y permitirá abrir directamente rutas como `/join/ABC123`.
