import {defineConfig} from 'vite';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                admin: 'admin/index.html',
                login: 'login/index.html',
                logout: 'logout/index.html',
                change_pass: 'change_pass/index.html',
            },
        },
    },
});