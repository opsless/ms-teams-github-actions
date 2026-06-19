// The json plugin is required because adaptivecards-templating does `require('./../package.json')`.

import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import esbuild from 'rollup-plugin-esbuild'

const config = {
  input: 'src/main.ts',
  output: {
    esModule: true,
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true
  },
  plugins: [
    esbuild({
      target: 'es2022',
      tsconfig: './tsconfig.json',
      minify: true
    }),
    nodeResolve({preferBuiltins: true}),
    json({preferConst: true}),
    commonjs()
  ]
}

export default config
