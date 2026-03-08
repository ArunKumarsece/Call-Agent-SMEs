
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
        sourcemap: true,
        minify: false,
    }
});
