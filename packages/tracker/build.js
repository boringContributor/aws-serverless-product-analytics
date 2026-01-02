import { build } from 'esbuild';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const isWatch = process.argv.includes('--watch');

const commonOptions = {
  bundle: true,
  minify: true,
  sourcemap: true,
  target: ['es2020'],
  platform: 'browser',
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.VERSION': `"${packageJson.version}"`,
  },
  banner: {
    js: `/*! @analytics/tracker v${packageJson.version} | MIT License */`,
  },
  legalComments: 'none',
  treeShaking: true,
  pure: ['console.log', 'console.debug'],
  drop: ['debugger'],
  logLevel: 'info',
};

// IIFE build for script tags
const iifeOptions = {
  ...commonOptions,
  entryPoints: ['src/analytics.ts'],
  format: 'iife',
  globalName: 'Analytics',
  outfile: 'dist/analytics.js',
};

// ESM build for module imports
const esmOptions = {
  ...commonOptions,
  entryPoints: ['src/index.ts'],
  format: 'esm',
  outfile: 'dist/index.js',
};

async function buildScript() {
  try {
    if (isWatch) {
      const ctx1 = await build({
        ...iifeOptions,
        minify: false,
      });

      const ctx2 = await build({
        ...esmOptions,
        minify: false,
      });

      await Promise.all([ctx1.watch(), ctx2.watch()]);
      console.log('👀 Watching for changes...');
    } else {
      await Promise.all([
        build(iifeOptions),
        build(esmOptions),
      ]);
      console.log('✅ Build completed successfully!');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildScript();
