# COMMAND — BCAz Roundtable

Last lock: 2026-09-20

This file is the authority file. If another doc disagrees, this one wins.

## The product

- Repo: `Cmooreculinary/BCAz-Roundtable`
- Product name on screen: Roundtable_VO
- Frontend target: Vercel (production URL pending first authenticated deploy)
- Backend target: pending selection of a persistent ASGI/WebSocket host
- Required frontend variable: `REACT_APP_BACKEND_URL=https://<backend-host>`

## Retired hosting

- Render is no longer the deployment target. Do not create another Roundtable Render service.
- `render.yaml` was removed to prevent an accidental Render deployment.

## Vercel boundary

- Vercel hosts the static React frontend only.
- Do not deploy the current FastAPI service as a Vercel Function. Calls and presence use
  long-lived WebSockets and process-local state; SQLite and uploads require durable storage.
- Production cannot launch until a persistent backend is selected and its URL is entered
  in Vercel as `REACT_APP_BACKEND_URL`.

## Done this lock

- COMMAND.md on main (#74)
- API timeout + one GET retry + clearer wake errors (#75)
- Confirmed already in code: table viz `useStageFit`, Portal create-table wired, Gather Save/End labeled as demo, table load retry, video call blocked with toast when no other member
- Hugging Face `transformers` Python stack: out of scope for this deploy

## Work now (only this)

1. Select and deploy the persistent backend host.
2. Set its `CORS_ORIGINS` to the exact Vercel production origin.
3. Set Vercel `REACT_APP_BACKEND_URL`, deploy, then run `LIVE_PASS.md`.

## Not now

Conrad, Jagers, Paladin, BCA XO, new slugs, Gather pricing, `pip install transformers`.

Tracker: issue #73
