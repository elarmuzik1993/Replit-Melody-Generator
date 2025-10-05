import { copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Copy index.html to 404.html for GitHub Pages SPA routing
const distPath = join(__dirname, 'dist', 'public');
copyFileSync(join(distPath, 'index.html'), join(distPath, '404.html'));
console.log('✓ Created 404.html for GitHub Pages');
