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

## PT no-show policy

The API scans confirmed PT bookings on startup and every minute. When a booking has ended for at least 15 minutes without a QR check-in, the API marks it `ABSENT_NO_REFUND` and deducts one session from its linked PT membership. The status change and deduction happen in one database transaction, so the same booking cannot be charged twice. The member receives a notification. Past confirmed bookings are included when the server starts, including bookings created before this worker was added.

If the linked membership has no remaining session, the booking is marked absent with `cancelledBy: SYSTEM_NO_SHOW_NO_DEBIT`; no negative balance is created. The admin member profile flags this case for manual review.

An Admin or Staff account can correct an automatically charged absence with `POST /api/pt/booking/:id/resolve-no-show` and a JSON body containing `resolution` (`ATTENDED` or `EXCUSED`) and a nonempty `reason`. `ATTENDED` records a completed session and keeps the deduction. `EXCUSED` refunds one session and records an excused absence. Corrections are logged and the member is notified.

## Coach web APIs

The Coach workspace uses `GET /api/pt/coach/me`, `GET /api/pt/coach/trainees`, `GET/POST /api/pt/coach/plans`, and `PUT /api/pt/coach/availability`. These endpoints use the authenticated Coach identity; the Admin trainer list is restricted to Admin/Staff.

PT sessions use `GET /api/pt/my-bookings`, `PATCH /api/pt/booking/:id/status` (`CONFIRMED` or `REJECTED`), `POST /api/pt/booking/:id/generate-session-qr`, `POST /api/pt/booking/:id/complete-session`, and `POST /api/pt/booking/:id/mark-absent`. A member scans the Coach's QR with `POST /api/pt/booking/start-session`. The Coach can also use booking messages and workout log/progress endpoints. Coach absence grants the member a make-up booking without deducting a session.
