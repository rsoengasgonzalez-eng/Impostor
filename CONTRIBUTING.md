# Contribuir

1. Crea una rama desde `main`.
2. Ejecuta `npm install`.
3. Mantén la lógica autoritativa en el Worker/Durable Object; el cliente no decide resultados.
4. Añade tests para cualquier cambio en reglas.
5. Ejecuta `npm run check && npm test && npm run build`.
6. Abre un pull request con una descripción del cambio y capturas si modifica la interfaz.

No incluyas tokens, `.dev.vars`, identificadores de D1 privados ni archivos `.env`.
