import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Mantém o build portátil em GitHub Pages, inclusive em repositório /nome-do-repo/.
  base: './',
})
