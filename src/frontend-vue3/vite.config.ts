import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  
  build: {
    manifest: true,
    rollupOptions: {
      // overwrite default .html entry
      input: 'src/main.ts',
    },
  },


  server: {
    port: 8081,
    origin: 'http://localhost:8081', // for embedded links to asset files in the vite project
    host: '0.0.0.0',
    proxy: {
      '/corpus-frontend': 'http://127.0.0.1:8080/corpus-frontend',
    },
  }
})
