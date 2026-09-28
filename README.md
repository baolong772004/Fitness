# Fitness Platform

Starter monorepo for a fitness application.

## Components

- `frontend`: React + TypeScript + Vite dashboard.
- `backend`: Node.js + Express REST API.
- `ai-module`: Node.js + Express service that suggests workouts.

## Setup

```bash
npm install
```

Run each service in a separate terminal:

```bash
npm run dev:frontend
npm run dev:backend
npm run dev:ai
```

The frontend is served at `http://localhost:5173`, backend at `http://localhost:4000`, and AI module at `http://localhost:4001`.

## API endpoints

- `GET /api/health` — backend health check
- `GET /api/workouts` — sample workout list
- `POST /api/suggestions` — AI module. JSON body: `{ "goal": "strength", "level": "beginner" }`

