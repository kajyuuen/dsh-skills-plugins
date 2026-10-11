import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: true,
  clean: true,
  deps: {
    alwaysBundle: [
      '@deepseek-ai/schemastery',
      /^@deepseek-ai\/dsh-experimental-speech-to-text(?:\/.*)?$/,
      'zod',
    ],
    onlyBundle: false,
  },
})
