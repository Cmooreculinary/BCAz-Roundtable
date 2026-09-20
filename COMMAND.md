# COMMAND — BCAz Roundtable

Last lock: 2026-09-20 03:55 CDT

This file is the authority file. If another doc disagrees, this one wins.

## The product

- Repo: `Cmooreculinary/BCAz-Roundtable`
- Product name on screen: Roundtable_VO
- Live app: https://roundtable-vo-frontend.onrender.com
- Live API: https://roundtable-vo-backend.onrender.com/api/
- Health: `{"service":"Roundtable_VO API","status":"ok"}`

## Dead names

- https://bcaz-roundtable.onrender.com — 404. Do not rebuild this slug.
- Do not create another Roundtable Render service.
- Do not treat other BCAz apps on Render as this product.

## Sleep

- Frontend is a static site. It does not sleep.
- Backend is Starter + disk. It does not Free-tier sleep.
- If the first load is slow, it is a deploy/restart, not idle spin-down.

## Done this lock

- COMMAND.md on main (#74)
- API timeout + one GET retry + clearer wake errors (#75)
- Confirmed already in code: table viz `useStageFit`, Portal create-table wired, Gather Save/End labeled as demo, table load retry, video call blocked with toast when no other member
- Hugging Face `transformers` Python stack: out of scope for this deploy

## Work now (only this)

1. Two-account live pass — see `LIVE_PASS.md`

## Not now

Conrad, Jagers, Paladin, BCA XO, new slugs, Gather pricing, `pip install transformers`.

Tracker: issue #73
