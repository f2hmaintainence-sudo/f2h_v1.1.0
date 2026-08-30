# ISS-038 — Composed `address_line` duplicates literal prefixes — "Flat Flat 402", "Near Near Old Bus Stand"

| Field | Value |
|---|---|
| **Issue ID** | `ISS-038` |
| **Test Case ID(s)** | CUST-ADDR-001 |
| **Module** | Customer / Address Formatting |
| **Severity** | **Low** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Composed `address_line` duplicates literal prefixes — "Flat Flat 402", "Near Near Old Bus Stand"

## Steps to Reproduce

1. `POST /api/v1/customer/bootstrap/address` with `flat_no: "Flat 402"` and `landmark: "Near Old Bus Stand"`.
2. Inspect the returned `address_line`, and the `address_line` copied onto any order.

## Expected Result

`"Flat 402, QA Test Apts, Main Road, Kuppam Central, Near Old Bus Stand, Kuppam, Andhra Pradesh, 517425"`

## Actual Result

`"Flat Flat 402, QA Test Apts, Main Road, Kuppam Central, Near Near Old Bus Stand, Kuppam, Andhra Pradesh, 517425"`

The same doubled string is then denormalised onto `orders.address_line`, so it reaches the delivery partner app and the printed manifest.

## Root Cause

The address composer unconditionally prefixes `"Flat "` before `flat_no` and `"Near "` before `landmark`, without checking whether the customer already typed those words. Customers naturally do.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/auth/customer-bootstrap.controller.ts` (`buildAddressData` / address-line composition)
- Tables: `customer_addresses.address_line`, `orders.address_line`

## Recommended Fix

Only add the prefix when the value does not already start with it (case-insensitive), or drop the hard-coded prefixes entirely and let the label come from the field name in the UI. Trim and collapse empty segments while composing.

## Regression Tests Required

- CUST-ADDR-001 (address line composed without duplicated prefixes)
- Cases: value with prefix, value without prefix, empty flat/landmark
