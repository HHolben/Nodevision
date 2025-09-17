// bundleCytoscape.mjs
// Purpose: Bundle and configure Cytoscape.js library for graph visualization
import esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['./Graph/entry-cytoscape.js'],
  bundle: true,
  format: 'esm',
  outfile: './public/cytoscape-bundle.js',
  target: 'es2020',
  minify: true,
  sourcemap: false,
}).then(() => {
  console.log("✅ cytoscape-bundle.js built.");
}).catch((e) => {
  console.error("❌ Build failed:", e.message);
});
