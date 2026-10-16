# Backend setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `MONGODB_URI`, `JWT_SECRET`, and the three PayOS credentials.
2. Create the SQL Server database named in `DATABASE_URL` and a MongoDB database, locally or on MongoDB Atlas.
3. From this directory, run `npm install`, `npx prisma migrate deploy`, and `npx prisma generate`. On a new empty database, the `0_init` migration creates the existing application schema before the Gym safety migration.
4. Start the API with `npm run dev`.

For an existing database created before Prisma Migrate, review any duplicate Active Gym memberships first, then run `npx prisma migrate resolve --applied 0_init` once to baseline the existing schema. Run `npx prisma migrate deploy` to apply `20261016_gym_membership_safety`, then `npx prisma generate` before restarting the backend. The Gym migration stops if a member still has multiple Active Gym memberships. Do not run `db push` against a deployed database.

## Database usage

SQL Server remains the source of truth for accounts, PT bookings, memberships, payments, and other relational records. PT chat messages are stored in MongoDB in the `pt_chat_messages` collection. Booking ownership and chat permissions are still checked against SQL Server.

On the first backend start after MongoDB is configured, existing PT chat messages are copied from the legacy SQL Server table into MongoDB. The import is idempotent and runs only once. New messages are written to MongoDB. The SQL table is retained as the migration source and is no longer used for new chat writes.

Set `MONGODB_URI` in `backend/.env` to a local MongoDB connection string or an Atlas connection string. If it is empty or MongoDB is unreachable, the rest of the backend can start, but PT chat APIs return `503` until MongoDB is available.

PayOS checkout requires valid credentials. Set `FRONTEND_URL` to the browser-accessible frontend URL for return/cancel redirects. Configure PayOS to send its webhook to the public HTTPS endpoint `POST /api/payments/webhook`; a local `localhost` URL cannot receive production PayOS webhooks.

Payment endpoints:

- `POST /api/payments/checkout` — authenticated; creates a pending membership and PayOS checkout link.
- `GET /api/payments/check-status/:orderCode` — authenticated; only the payment owner can check its status.
- `POST /api/payments/webhook` — verifies PayOS signature and amount, then activates the membership once.
- `POST /api/subscriptions/renew` — authenticated; creates a PayOS checkout link and applies the extension only after confirmed payment.

## Gym membership payment order

The queue uses the time the backend first verifies a successful payment from PayOS. That timestamp is stored in `Payment.paidAt`. The same database transaction takes a SQL Server application lock for the member, marks the payment paid, assigns `Membership.activationOrder`, and schedules the membership. Repeated webhook or status-check calls do not assign another queue position. For older payments, the original success time cannot be reconstructed; the migration preserves their scheduled start order.

Checkout blocks a second order for the same Gym package while its first order is `PENDING`. Renewal checkout also blocks a second unpaid renewal for the same membership. A renewal is checked again when PayOS success arrives: if the Gym membership is already `PENDING_ACTIVATION` or otherwise cannot be renewed, the payment becomes `PAID_REVIEW`, no entitlement is extended, and the member is told to contact support for a refund. Operations must review and refund these paid exceptions; refund automation and cancellation/expiry of unpaid PayOS orders are not implemented yet. The mobile UI should describe queue order as the order in which the backend confirms payments, not the bank payment time.

An Active Gym membership is unique per member through a filtered SQL Server index. The `isGymMembership` column distinguishes Gym from PT in the shared `Membership` table. The Gym worker runs on startup and every minute; it uses the same member lock, expires elapsed periods, and activates the next due membership without changing its scheduled start or end dates. `activatedAt` records the actual promotion time.

Run `npm run test:gym` only with `GYM_TEST_DATABASE_URL` pointing to a separate SQL Server database whose name includes `test`. Create the schema and apply the Gym migration to that database first. The integration suite writes and removes its own test records and covers concurrent payments, duplicate callbacks, ordering, renewals, concurrent refresh, restart recovery, duplicate pending checkout, and failed payments.

## PT no-show policy

The API scans confirmed PT bookings on startup and every minute. When a booking has ended for at least 15 minutes without a QR check-in, the API marks it `ABSENT_NO_REFUND` and deducts one session. The status change and deduction share a transaction and a per-membership SQL Server lock. If the balance is unexpectedly zero, the transaction rolls back and the worker logs the booking for investigation rather than recording an unpaid absence.

Members may report absence before the session starts. A report at least two hours early, within the package's three member make-up allowances, grants a seven-day make-up right without deducting a session. Late reports and absence from a make-up session deduct one session. Coach absence first creates a request for Admin. Once approved, the member receives a new seven-day make-up right without using their allowance, including when the Coach misses a make-up session. Rejection leaves the booking unchanged. A make-up right that expires releases its reservation without deducting a session; ordinary PT booking remains possible if the package is still valid.

An Admin or Staff account can correct an automatically charged absence with `POST /api/pt/booking/:id/resolve-no-show` and a JSON body containing `resolution` (`ATTENDED` or `EXCUSED`) and a nonempty `reason`. `ATTENDED` records a completed session and keeps the deduction. `EXCUSED` refunds one session and records an excused absence. Corrections are logged and the member is notified.

## Coach web APIs

## PT availability and master calendar

Apply `backend/prisma/migrations/20261016_pt_availability_calendar` with `npx prisma migrate deploy` from `backend`, then run `npx prisma generate` and restart the backend. On Windows, stop any backend process holding `query_engine-windows.dll.node` before generating the client. The migration adds the Gym calendar, closures and Coach date overrides without replacing existing weekly schedules.

Admin sets 06:00–22:00 by default, with fixed 60-minute PT sessions and optional breaks. Admin APIs: `GET/PUT /api/admin-trainers/calendar`, `POST /api/admin-trainers/calendar/closures`, `DELETE /api/admin-trainers/calendar/closures/:id`, `GET /api/admin-trainers/calendar/coaches?date=YYYY-MM-DD`, and `GET /api/admin-trainers/calendar/audit`. Changes overlapping future booked PT sessions are rejected. Date/time values in closure requests are UTC ISO instants; the web form presents Vietnam local time.

Coach APIs: `GET/PUT /api/pt/coach/availability` for weekly recurring hours; `PUT /api/pt/coach/availability/dates` with `{ "dates": [{ "date": "2026-10-20", "shifts": [{ "startTime": "08:00", "endTime": "12:00" }] }] }` for one or more date overrides; `DELETE /api/pt/coach/availability/dates/:date` restores the weekly pattern; `DELETE /api/pt/coach/availability/slots?date=YYYY-MM-DD&startTime=HH:mm` removes one unbooked slot. An empty `shifts` array means a day off. All wall-clock values use `Asia/Ho_Chi_Minh`. The member slot list and booking endpoint use the same slot calculation. Weekly changes cannot invalidate future bookings, and date changes cannot remove elapsed slots or booked slots. Admin and Coach changes are recorded in `ActionLog`.

For a booked slot, Coach reports absence using `POST /api/pt/coach/availability/change-requests` or the existing `POST /api/pt/booking/:id/mark-absent` action. Admin views `GET /api/admin-trainers/calendar/change-requests` and approves or rejects with `PATCH /api/admin-trainers/calendar/change-requests/:id` (`decision` = `APPROVED` or `REJECTED`). Approval marks Coach absence, removes that slot from the Coach's date availability, creates a seven-day make-up right, and notifies both parties. The original booked slot remains protected while the request is pending.

The Coach workspace uses `GET /api/pt/coach/me`, `GET /api/pt/coach/trainees`, `GET/POST /api/pt/coach/plans`, and `PUT /api/pt/coach/availability`. These endpoints use the authenticated Coach identity; the Admin trainer list is restricted to Admin/Staff.

PT sessions use `GET /api/pt/my-bookings`, `POST /api/pt/booking/:id/generate-session-qr`, `POST /api/pt/booking/:id/complete-session`, and `POST /api/pt/booking/:id/mark-absent`. A member scans the Coach's QR with `POST /api/pt/booking/start-session`. `PATCH /api/pt/booking/:id/status` remains available for older pending bookings. The Coach can also use booking messages and workout log/progress endpoints.

## PT booking and chat

`POST /api/pt/booking` now confirms a valid 60-minute Coach slot immediately. It requires a two-hour lead time, a Coach work shift, Gym access for the full session, and an active PT package with an unreserved session. `POST /api/pt/booking/schedule-makeup` confirms a valid slot with the same Coach within the seven-day make-up window. A SQL Server application lock serializes bookings by Coach, member, and entitlement across backend instances. Confirmed bookings and live make-up rights reserve sessions; completion, late absence, and no-show deduct exactly one. The legacy Coach approval route only handles older pending bookings.

Gym packages with `trialPtSessions` use their own `Membership.remainingSessions` as the free PT entitlement. Members select a Coach when booking a trial; the Gym membership remains active after the trial sessions are used. A second paid PT package creates a separate entitlement with its own session balance.

MongoDB chat history is grouped by member and Coach across PT bookings. Reading a conversation marks the other person's messages as read. Messages remain readable after the PT relationship ends, while sending is permitted only during an active PT relationship or future confirmed booking. Socket.IO sends chat messages, read receipts, booking notifications, and Coach schedule changes in real time.

Time-only PT extensions have no separately priced product in the current catalog. The renewal API rejects PT time extensions so it cannot charge the full PT package price while adding no sessions. Members can buy a new PT package for additional sessions. A dedicated time-extension product and price must be added before selling that option.
If a PT checkout succeeds after Gym access expires or the selected Coach becomes inactive, the verified payment is marked `PAID_REVIEW` and the PT entitlement is not activated. Operations must resolve or refund that payment.
