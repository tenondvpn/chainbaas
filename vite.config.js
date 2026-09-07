import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

export default defineConfig({
  plugins: [vue(), vueJsx()],
  server: {
    proxy: {
      '/explorer': { target: 'http://127.0.0.1:30301', changeOrigin: true },
    }
  }
})
