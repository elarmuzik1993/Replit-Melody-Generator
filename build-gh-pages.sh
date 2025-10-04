#!/bin/bash
# Build for GitHub Pages deployment

# Clean up old builds
rm -rf dist

# Create necessary directories
mkdir -p dist

# Build the client with Vite for GitHub Pages (with base path)
DEPLOY_TARGET=github npx vite build

echo "GitHub Pages build complete!"
echo "- Client files ready for deployment in: dist/"
