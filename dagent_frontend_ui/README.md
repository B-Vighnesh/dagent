# DAGENT Frontend UI

A Vite and React single-page application for the DAGENT dark-pattern detector.

## Run locally

```powershell
npm install
npm run dev
```

## Quality checks

```powershell
npm run lint
npm run build
```

## Structure

- `src/pages` — route-level screens
- `src/components` — reusable UI and application shell
- `src/data` — display data used by screens
- `src/styles.css` — responsive global design system and component styles

Routes: `/`, `/scan`, `/download`, and `/feedback`.
