# Deployment

Recommended hackathon setup:

- Frontend: Vercel
- Backend: Render
- TestSprite: CLI-backed backend integration

## Backend On Render

Use the repository root as the Render service root.

Settings:

```txt
Runtime: Node
Build command: npm install && npm run build
Start command: npm start
Health check path: /api/health
```

Environment variables:

```txt
NODE_ENV=production
SHIPSHAPE_DATA_FILE=/tmp/shipshape-state.json
TESTSPRITE_API_KEY=your_testsprite_key
TESTSPRITE_CLI_BIN=testsprite
TESTSPRITE_TIMEOUT_SECONDS=900
```

Optional:

```txt
TESTSPRITE_PROJECT_ID=p_...
TESTSPRITE_TEST_ID=test_...
```

Render can also read `render.yaml`.

## Frontend On Vercel

Use `frontend` as the Vercel root directory.

Settings:

```txt
Framework preset: Vite
Build command: npm run build
Output directory: dist
```

Environment variables:

```txt
VITE_API_BASE_URL=https://your-render-backend.onrender.com
```

Vercel can also read `frontend/vercel.json`.

## TestSprite Project Creation

After both services are public:

1. Create an audit in ShipShape using the public frontend URL.
2. Open Checks.
3. Click `Create Project`.
4. Run TestSprite from ShipShape.

Manual CLI equivalent:

```bash
testsprite --output json project create --type frontend --name ShipShape --url https://your-frontend.vercel.app
```

Copy the returned `id` into ShipShape's TestSprite project id field if needed.

## Pre-Push Verification

Run:

```bash
npm test
npm run build
npm --prefix frontend run build
```
