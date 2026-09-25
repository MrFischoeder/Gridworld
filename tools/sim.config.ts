// Runs the headless simulations in tools/ (npm run sim): world logic only, no three.js, no DOM.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tools/**/*.sim.ts'], environment: 'node', testTimeout: 600000, reporters: ['default'], silent: false },
});
