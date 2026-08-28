import typescript from '@rollup/plugin-typescript';
import resolve    from '@rollup/plugin-node-resolve';
import terser     from '@rollup/plugin-terser';
import dts        from 'rollup-plugin-dts';

const input = 'src/index.ts';

export default [
  // ESM bundle
  {
    input,
    output: { file: 'dist/certilayer.esm.js', format: 'esm', sourcemap: true },
    plugins: [resolve(), typescript()],
  },
  // CJS bundle — .cjs extension is REQUIRED here: package.json has
  // "type": "module", so Node treats any plain .js file as ESM regardless
  // of its actual contents. Only .cjs is unconditionally CommonJS.
  {
    input,
    output: { file: 'dist/certilayer.cjs', format: 'cjs', sourcemap: true },
    plugins: [resolve(), typescript()],
  },
  // Browser bundle — minified, < 20KB target
  {
    input,
    output: { file: 'dist/certilayer.min.js', format: 'iife', name: 'CertiLayer', sourcemap: false },
    plugins: [resolve(), typescript(), terser({ compress: { passes: 2 } })],
  },
  // Type declarations
  {
    input: 'src/index.ts',
    output: { file: 'dist/index.d.ts', format: 'esm' },
    plugins: [dts()],
  },
];
