# ISS-026 — Production Planning and Product Batches tables return zero rows (`character varying = integer`)

| Field | Value |
|---|---|
| **Issue ID** | `ISS-026` |
| **Test Case ID(s)** | WH-FOR-001 |
| **Module** | Admin / Production Planning |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Production Planning and Product Batches tables return zero rows (`character varying = integer`)

## Steps to Reproduce

1. As ADMIN, `GET /api/v1/admin/production/planning/table?limit=3`.
2. `GET /api/v1/admin/production/batches/table?limit=3`.

## Expected Result

Production plans and batches listed.

## Actual Result

Both return HTTP 200 with `{"status":false,"data":[]}`.

Log (three times each): `{"table":"production_plans","errorCode":"42883","error":"operator does not exist: character varying = integer"}` and the same for `product_batches`.

## Root Cause

A join or filter compares a `varchar` identifier against an `integer` column without a cast — the recurring string-key vs numeric-key inconsistency also seen in ISS-019. PostgreSQL rejects the comparison with `42883`.

## Affected Files / API / Tables

- `apps/api/src/panels/admin/catalog-inventory/production/...` planning and batches table services
- Tables: `production_plans`, `product_batches`

## Recommended Fix

Identify the mismatched pair and align the types (prefer the varchar business key, consistent with the rest of the schema) rather than adding a `::text` cast, which would hide the modelling inconsistency and defeat the index.

## Regression Tests Required

- WH-FOR-001 (demand forecast / production requirements)
- Production planning and batches tables list rows
