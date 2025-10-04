#!/bin/bash
# Production build for Replit

# Clean up old builds
rm -rf dist

# Create necessary directories
mkdir -p dist

# Build the client with Vite (outputs to dist/)
npx vite build

# Move client files to dist/public (where bundled server expects them)
mkdir -p dist/public
mv dist/index.html dist/public/
mv dist/assets dist/public/

# Build the server with esbuild (to dist/index.js)
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js

echo "Production build complete!"
echo "- Client files: dist/public/"
echo "- Server file: dist/index.js"
