import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { mockBackendPlugin } from './src/server/devMockMiddleware';
import { prodBackendPlugin } from './src/server/prodMiddleware';

const mode = process.env.WORKBENCH_MODE ?? 'production';
const backendPlugin = mode === 'mock' ? mockBackendPlugin() : prodBackendPlugin();

// 启动时打印当前模式横幅
// eslint-disable-next-line no-console
console.log(`\n  [Workbench] WORKBENCH_MODE = ${mode === 'mock' ? 'mock (pnpm copy)' : 'production (pnpm dev)'}\n`);

export default defineConfig({
  plugins: [react(), backendPlugin],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    host: true
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          antd: ['antd'],
          echarts: ['echarts', 'echarts-for-react']
        }
      }
    }
  }
});
