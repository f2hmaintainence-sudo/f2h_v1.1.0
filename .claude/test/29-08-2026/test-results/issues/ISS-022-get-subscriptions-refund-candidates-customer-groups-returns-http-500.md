# ISS-022 — `GET /subscriptions/refund-candidates/customer-groups` returns HTTP 500

| Field | Value |
|---|---|
| **Issue ID** | `ISS-022` |
| **Test Case ID(s)** | SUB-RFD-002, RFD-SUB-001 |
| **Module** | Admin / Subscription Refund Review |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

`GET /subscriptions/refund-candidates/customer-groups` returns HTTP 500

## Steps to Reproduce

1. As ADMIN, `GET /api/v1/subscriptions/refund-candidates/customer-groups`.

## Expected Result

Refund candidates grouped by customer for the review accordion.

## Actual Result

HTTP 500 `{"message":"Failed to fetch customer groups",...}`.

Log: `column src.reviewed_by does not exist (42703)` at `refund-candidates.repository.ts:240`.

## Root Cause

The grouping query references `src.reviewed_by` on `subscription_refund_candidates`. That table has `approved_by` and `approved_at`, not `reviewed_by`.

## Affected Files / API / Tables

- `apps/api/src/panels/admin/customers-orders/subscriptions/refund-candidates/refund-candidates.repository.ts:240`
- `.../refund-candidates.service.ts:91`
- Table: `subscription_refund_candidates`

## Recommended Fix

Use `src.approved_by` (and `approved_at`), or add the `reviewed_by` column if a distinct reviewer/approver split is intended.

## Regression Tests Required

- SUB-RFD-002 (admin review screen loads and groups candidates)
- Depends on ISS-003 and ISS-004 for meaningful data
