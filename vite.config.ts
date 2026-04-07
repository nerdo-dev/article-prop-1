import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

import {localProposalApiPlugin} from './server/local-api-plugin';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  Object.assign(process.env, env);
  return {
    plugins: [react(), tailwindcss(), localProposalApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
