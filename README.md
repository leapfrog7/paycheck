# Paycheck

A frontend-only, installable Central Government pay and arrears calculator built with React and Vite.

## Architecture

```text
paycheck/
├── src/
│   ├── components/
│   ├── pages/
│   ├── features/
│   ├── engines/
│   ├── data/
│   ├── utils/
│   ├── hooks/
│   ├── pwa/
│   ├── storage/
│   └── App.jsx
├── docs/
├── public/
└── README.md
```

## Installable app

PayCheck is a Progressive Web App (PWA). In supported browsers, use **Install app** in the header or home page. When a browser does not expose a direct install prompt, PayCheck shows the correct Add to Home Screen guidance instead.

The production build precaches the application shell so an already visited build can reopen offline. Saved cases remain in browser storage and are not uploaded to a server. Run a production build or `npm run test:e2e` when testing install/offline behavior; service workers are intentionally disabled during the Vite development server.

To regenerate the PNG app icons after changing `public/app-icon.svg`:

```bash
npm run icons:pwa
```

## Planned capabilities

- client-side rule tables
- calculation engines
- browser storage for saved data
- local export utilities
- no backend required for the initial phase

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Pushes to `master` are tested and deployed to GitHub Pages by `.github/workflows/deploy-pages.yml`. The deployment build uses the `/paycheck/` base path and includes an SPA fallback for saved-case and workspace URLs.

## Verification

```bash
npm test
npm run lint
npm run test:e2e
```

The end-to-end suite builds the production app and runs the guided setup, case workspace, PWA metadata/install help and offline shell in installed Chrome at desktop and Pixel 7 viewports.
