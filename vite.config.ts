import { defineConfig, type Plugin } from 'vitest/config';
import { createMp } from './server/mp.mjs';

/** The multiplayer server rides on the game's own dev / preview server at /mp (server/mp.mjs): whoever starts the game hosts. */
const multiplayer = (): Plugin => {
  const hook = (http: import('node:http').Server | null | undefined) => {
    if (!http) return; // (vitest runs Vite without an http server)
    const mp = createMp();
    mp.attach(http);
    http.on('close', mp.close);
  };
  return { name: 'gridworld-multiplayer', configureServer: (s) => hook(s.httpServer as import('node:http').Server | null), configurePreviewServer: (s) => hook(s.httpServer as import('node:http').Server) };
};

export default defineConfig({
  base: './',
  plugins: [multiplayer()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1000 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', testTimeout: 30000 },
});
