# CrisWorkspace

Espacio de trabajo todo en uno con dos secciones:

- **Organización**: carpetas y notas al estilo Notion, con bloques (texto, títulos, tareas, viñetas, citas, código, separadores) y archivos adjuntos. Todo se guarda solo en el navegador (IndexedDB) medio segundo después de cada cambio.
- **Estudio de Vídeo**: programa vídeos para Instagram, Facebook, X, TikTok y YouTube en un minuto concreto del directo. El botón «INICIAR Y SINCRONIZAR DIRECTO» arranca el reloj maestro y cada vídeo se publica en todas sus redes a la vez al llegar a su minuto.

> **Importante:** la publicación en redes está **simulada**. La app comprueba las reglas de cada red y simula la subida, pero no envía nada a internet. Para publicar de verdad hacen falta las apps de desarrollador de cada red (OAuth) y una parte de servidor que guarde los tokens; el punto donde se conectan está en `src/lib/publishing/publishers.ts`.

## Arrancar

```powershell
npm install
npm run dev
```

Abre http://localhost:3000.

## Comprobaciones

```powershell
npm run build
npx tsc --noEmit
npx eslint .
```

El motor lógico (reloj, disparo de vídeos, publicación, notas) tiene una simulación en Node que recorre una hora de directo: ver la cabecera de `scripts/simular-motor.ts` para ejecutarla.

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `src/types/workspace.ts` | Contrato de tipos entre la lógica y la interfaz |
| `src/lib/` | Funciones puras: árbol de notas, validación, reloj, publicación, almacenamiento |
| `src/store/` | Estado con Zustand persistido en IndexedDB |
| `src/hooks/` | Carga de datos, motor del reloj maestro y media queries |
| `src/components/` | Interfaz: `Sidebar3D`, `NotionSection`, `VideoStudioSection` |
| `src/app/page.tsx` | Ensamblaje de todo |
