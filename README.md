# Northstar Workspace

A small Node.js example showing cookie-backed sessions, login, protected sections, and logout without a framework.

## Run it

Requires Node.js 18 or newer.

```bash
npm start
```

Open `http://localhost:3000` and use the demo account:

- Email: `jordan@example.com`
- Password: `secret123`

## What it demonstrates

- `POST /api/login` validates credentials and creates an in-memory session.
- The session ID is sent as an `HttpOnly`, `SameSite=Lax` cookie.
- `GET /api/session` checks whether the browser is signed in.
- `GET /api/private/overview` is protected and returns workspace sections only for an authenticated user.
- `POST /api/logout` removes the session and expires the cookie.

The in-memory session store is intentionally simple for learning. Production applications should use a persistent session store, hashed passwords, CSRF protection, rate limiting, and HTTPS.