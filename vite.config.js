import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],

  // 👇 This fixes React Router 404 on refresh
  server: {
    historyApiFallback: true
  },

  // 👇 This fixes it when running: vite preview
  preview: {
    historyApiFallback: true
  }
})
