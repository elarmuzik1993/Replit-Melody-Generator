# Build Instructions

## Production Build (for Replit)

To build the application for production on Replit:

```bash
./build.sh
# or
./build-prod.sh
```

Then start the production server:

```bash
npm start
```

This will:
- Build the client files to `dist/public/`
- Build the server to `dist/index.js`
- The production server will serve static files from `dist/public/`

## GitHub Pages Deployment

To build and deploy to GitHub Pages:

```bash
# Build for GitHub Pages
./build-gh-pages.sh

# Deploy to GitHub Pages
npm run deploy
```

This will:
- Build the client with the correct base path (`/Replit-Melody-Generator/`)
- Output files to `dist/` ready for GitHub Pages deployment

## Issue with `npm run build`

⚠️ **Note**: The `npm run build` command in package.json has a known issue where the build order causes Vite to delete the server file. Please use the shell scripts above instead.

## File Structure After Build

### Production Build (Replit)
```
dist/
├── index.js          # Bundled server
└── public/           # Client files
    ├── index.html
    └── assets/
```

### GitHub Pages Build
```
dist/
├── index.html        # Client entry
└── assets/           # Client assets
```
