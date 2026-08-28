import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		// Playwright e2e 用例(*.spec.ts)由 playwright.config.ts 独立驱动,
		// vitest 误扫会导致 collect 失败("Playwright Test did not expect
		// test.describe() to be called here"),此处显式排除
		exclude: ['**/node_modules/**', 'src/routes/workspace/editor/__tests__/*.spec.ts']
	},
	server: {
		port: 5173,
		strictPort: false,
		proxy: {
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: true
			}
		}
	}
});
