import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ command }) => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        ...(command === 'build' ? [
          { find: /.*\/contrastChecker$/, replacement: path.resolve(import.meta.dirname, 'src/utils/contrastChecker.empty.ts') },
          { find: /.*\/contrastChecker\.ts$/, replacement: path.resolve(import.meta.dirname, 'src/utils/contrastChecker.empty.ts') },
        ] : []),
        { find: /^@\/src\/(.*)/, replacement: path.resolve(import.meta.dirname, 'src/$1') },
        { find: /^@\/(.*)/, replacement: path.resolve(import.meta.dirname, 'src/$1') },
        { find: '@', replacement: path.resolve(import.meta.dirname, 'src') },
      ],
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : { usePolling: true, interval: 100 },
    },
  };
});
