import { writable } from 'svelte/store';

export const theme = writable<'light' | 'dark'>('light');

export function toggleTheme() {
	theme.update((current) => (current === 'light' ? 'dark' : 'light'));
}
