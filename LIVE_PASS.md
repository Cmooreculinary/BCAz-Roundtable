# Two-account live pass

Run this on the live pair only.

- App: https://roundtable-vo-frontend.onrender.com
- API: https://roundtable-vo-backend.onrender.com/api/

Use two real browsers or a normal window + a private window. Do not invent a third Render service to test this.

## Checklist

1. API health returns `status: ok`.
2. Account A registers and lands in Portal.
3. Account A creates a table.
4. Account A invites Account B (code or link).
5. Account B joins that table.
6. A and B both see the other seated (or can claim a seat).
7. A sends B a table message; B sees it without refresh (or after one refresh — note which).
8. A shares one file; B can open it.
9. A starts a video call; B gets the incoming toast and can answer or decline.
10. Hang up. Both return to the table. No stuck overlay.

## How to report a miss

Comment on issue #73 with:

- Step number that failed
- What you saw (one sentence)
- Browser + phone or desktop

That miss is the next code change. Nothing else jumps the line.
