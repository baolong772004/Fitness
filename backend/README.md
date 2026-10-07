# Backend setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET`, and the three PayOS credentials.
2. Create the MySQL database named in `DATABASE_URL`.
3. From this directory, run `npm install`, `npx prisma db push`, and `npx prisma generate`.
4. Start the API with `npm run dev`.

The repository currently uses Prisma schema sync (`db push`) and does not contain migration files. Use a disposable development database for this setup. For a deployed database, introduce and review migrations instead of applying schema changes with `db push`.

PayOS checkout requires valid credentials. Set `FRONTEND_URL` to the browser-accessible frontend URL for return/cancel redirects. Configure PayOS to send its webhook to the public HTTPS endpoint `POST /api/payments/webhook`; a local `localhost` URL cannot receive production PayOS webhooks.

Payment endpoints:

- `POST /api/payments/checkout` — authenticated; creates a pending membership and PayOS checkout link.
- `GET /api/payments/check-status/:orderCode` — authenticated; only the payment owner can check its status.
- `POST /api/payments/webhook` — verifies PayOS signature and amount, then activates the membership once.
- `POST /api/subscriptions/renew` — authenticated; creates a PayOS checkout link and applies the extension only after confirmed payment.
