// See: https://rollupjs.org/introduction/

import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'

const dependencyPath = /[/\\]node_modules[/\\]/
const ignoredCircularDependencies = [
  '/node_modules/@actions/core/lib/core.js',
  '/node_modules/@actions/core/lib/oidc-utils.js',
  '/node_modules/semver/classes/comparator.js',
  '/node_modules/semver/classes/range.js'
]

const config = defineConfig({
  input: 'src/index.ts',
  onwarn(warning, defaultHandler) {
    if (
      warning.code === 'THIS_IS_UNDEFINED' &&
      warning.id &&
      dependencyPath.test(warning.id) &&
      warning.frame?.includes('var __awaiter = (this && this.__awaiter)')
    ) {
      return
    }

    if (
      warning.code === 'CIRCULAR_DEPENDENCY' &&
      warning.ids?.every((id) =>
        ignoredCircularDependencies.some((dependency) =>
          id.replaceAll('\\', '/').endsWith(dependency)
        )
      )
    ) {
      return
    }

    defaultHandler(warning)
  },
  output: {
    esModule: true,
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true
  },
  plugins: [typescript(), nodeResolve({ preferBuiltins: true }), commonjs()]
})

export default config
