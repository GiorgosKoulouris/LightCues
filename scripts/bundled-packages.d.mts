import type { Plugin } from 'vite';

export const BUNDLED_PACKAGES_FILE: string;
export function bundledPackages(): Plugin;
export function packageOf(id: string): { path: string; dir: string } | null;
