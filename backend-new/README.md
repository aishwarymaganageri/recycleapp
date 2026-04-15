# backend-new

New backend for RecycleApp with the same API routes used by your website and mobile app.

## Setup

1. Copy `.env.example` to `.env`
2. Fill `MONGO_URI` and `JWT_SECRET`
3. Install dependencies and run:

```bash
npm install
npm run dev
```

## API Routes

- `GET /api/health`
- `POST /api/register`
- `POST /api/login`
- `POST /api/add-waste` (auth)
- `GET /api/points` (auth)
- `GET /api/history` (auth)

## Notes

- Default port is `3001` to avoid conflict with your existing backend.
- To use this backend in app/web, set API base URL to `http://localhost:3001/api` (web) or `http://10.0.2.2:3001/api` (Android emulator).
