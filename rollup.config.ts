import { defineConfig } from 'rollup'
import typescript from '@rollup/plugin-typescript'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default defineConfig({
  input: 'src/main.ts',
  output: {
    file: 'dist/index.js',
    format: 'es',
    banner: '#!/usr/bin/env node'
  },
  external: [
    '@actions/core',
    '@actions/github',
    'adaptive-expressions',
    'adaptivecards',
    'adaptivecards-templating',
    'cockatiel'
  ],
  plugins: [
    nodeResolve({
      preferBuiltins: true
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json'
    })
  ]
})
