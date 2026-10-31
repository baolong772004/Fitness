# PT credit expiry rollout (2026-10-20)

## Existing data audit

Run `npx tsx scripts/auditPtExpiry.ts` against the target database before deployment. It is read only.

The local `fitness_db` audit before migration found:

| Source | Batches without endAt | Remaining sessions |
| --- | ---: | ---: |
| MEMBERSHIP_GIFT | 1 | 2 |
| PACKAGE_PURCHASE | 1 | 10 |

One existing `PtProduct` has no duration. Four historical PT Membership rows have no `Package.ptLevel`; those need the existing wallet backfill review described in `pt-wallet-rollout.md`.

## Data policy and deployment

1. Back up SQL Server and retain the audit output. Reconcile the four legacy Membership rows before running the separate wallet backfill; do not guess their level.
2. Apply `20261020_pt_credit_expiry`, `20261020_pt_renewal` and `20261020_pt_renewal_product_scope` with `prisma migrate deploy`, then run `prisma generate` and restart the backend. These migrations preserve old entitlements.
3. Existing paid batches with `endAt = NULL` remain usable without an expiry until a separate conversion policy is approved. Do not backdate an expiry from the old payment date or a booking date. Trial batches continue to follow the granting Gym Membership's current dates.
4. In Web Admin, enter a positive `durationDays` for each product that should be sold. Products without one are hidden from the member catalog and checkout rejects them. New checkout orders snapshot level, session count and duration, so later catalog edits cannot change a pending purchase.
5. Configure `PtRenewalOption` prices and durations for each PT product in Web Admin before offering duration extension. The product determines the option's name and level; the renewal duration and price are configured separately. New options are linked to `PtProduct`, and checkout validates the original purchase product. Existing options are linked by migration only when name and level identify exactly one product; unmatched legacy options remain level-wide and should be reviewed in Web Admin. Renewal acts on one paid batch with unused credit and a known `endAt`; Trial and old unlimited batches cannot be renewed. An expired batch can be renewed within 30 days; an order confirmed after that deadline goes to `PAID_REVIEW` without changing the batch. Buying more sessions creates a separate batch.
6. Reconcile expired, held and consumed counts per batch after deployment. Renewal history is stored in `PtRenewalEvent` with a unique payment ID and the old/new expiry dates.

The expiry and initial renewal migrations were applied to `fitness_db` by the user. The product scope migration has been applied only to `fitness_pt_test`; all 46 PT integration tests passed there. Back up `fitness_db` before applying the remaining migration, then run `prisma generate` and restart the backend. The Gym integration tests passed before this product scope change and were not rerun because Gym behavior is unchanged.
