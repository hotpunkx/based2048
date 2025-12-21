import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',     // Ensure source root is current directory
    publicDir: 'public',
    build: {
        outDir: 'dist',
        emptyOutDir: true
    },
    server: {
        port: 5173,
        open: false
    }
});
