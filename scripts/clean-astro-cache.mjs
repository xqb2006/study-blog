import { rm } from 'node:fs/promises';

const paths = ['.astro', 'node_modules/.astro', 'node_modules/.vite'];

await Promise.all(paths.map((path) => rm(path, { force: true, recursive: true })));
