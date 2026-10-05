import os

fp = 'vite.config.js'
content = '''import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const debugMode = process.env.DEBUG_BUILD === '1';
const buildVersion = Date.now().toString();

export default defineConfig(() => ({
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [
    react(),
    {
      name: 'version-plugin',
      writeBundle(options) {
        fs.writeFileSync(
          path.resolve(options.dir, 'version.json'),
          JSON.stringify({ version: buildVersion })
        );
      }
    }
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
'''
with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated vite.config.js")
