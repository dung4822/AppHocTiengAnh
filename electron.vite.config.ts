import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    // Không bundle node_modules vào main: giữ nguyên các thư viện native (better-sqlite3, onnxruntime)
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          // Process riêng chạy Kokoro TTS (để không làm đơ giao diện)
          ttsWorker: resolve('src/main/services/tts/ttsWorker.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    resolve: { alias: { '@shared': resolve('src/shared') } },
    // Tailwind CSS v4 (token màu/chữ khai báo trong styles.css)
    plugins: [react(), tailwindcss()]
  }
})
