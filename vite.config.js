import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const debugMode = process.env.DEBUG_BUILD === '1';

export default defineConfig(() => ({
  plugins: [
    react()
  ],
  build: {
    // Ship sourcemaps in production so minified errors can be mapped back to source.
    sourcemap: true,
    minify: debugMode ? false : 'esbuild',
    rollupOptions: debugMode
      ? { output: { minifyInternalExports: false } }
      : undefined,
  }
}))
