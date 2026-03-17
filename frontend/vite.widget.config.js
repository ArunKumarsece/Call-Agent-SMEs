
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    envDir: '.',
    define: {
        'process.env': {}
    },
    build: {
        lib: {
            entry: resolve(__dirname, 'src/widget-entry.js'),
            name: 'AgentWidget',
            fileName: () => 'agent-widget.js',
            formats: ['iife'],
        },
        outDir: '../backend/static/widget',
        emptyOutDir: false,
        // Minify for production (smaller file size, faster load)
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true, // Remove console logs in production
            },
            output: {
                comments: false, // Remove comments
            },
        },
        // Generate source map for debugging (but excluded from final bundle)
        sourcemap: 'hidden',
        // Optimize chunk size
        chunkSizeWarningLimit: 100,
        rollupOptions: {
            output: {
                // Inline all assets to make widget self-contained
                inlineDynamicImports: true,
            }
        }
    }
});
