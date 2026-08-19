# Project Agent Rules & Conventions

## 1. REST API Route Endpoint Conventions
- **No CamelCase / PascalCase in Route Roots or Endpoints**: All API route paths and controller root decorators MUST use lowercase `kebab-case`.
  - **Correct**: `@Controller({ path: 'delivery-partner/profile', version: '1' })`
  - **Incorrect**: `@Controller({ path: 'DeliveryPartner/profile', version: '1' })`
- **Backward Compatibility**: When updating legacy endpoints from camelCase/PascalCase, use array routing to support both `kebab-case` (primary) and legacy aliases (secondary).
  - Example: `@Controller({ path: ['delivery-partner/auth', 'DeliveryPartner/auth'], version: '1' })`

## 2. Database Schema Alignment & SQL Rules
- **Schema Single Source of Truth**: All identity properties (`first_name`, `last_name`, `phone`, `email`, `user_name`) live on the `users` table.
- **Satellite Tables (`customers`, `delivery_partners`)**: Satellite tables contain ONLY domain-specific extension fields (e.g. `wallet_balance`, `is_active`, `vehicle_type`).
- **SQL JOIN Standard**: Queries retrieving identity information alongside domain profiles MUST explicitly `JOIN users u ON u.user_id = profile.id` rather than querying missing columns on satellite tables.
- **Parameter Binding**: Always use `$1`, `$2` PostgreSQL parameter placeholders (never MySQL `?` placeholders).

## 3. Deployment & Mandatory Git Synchronization
- **Complete Git Auto-Push Policy**: Upon completing ANY task, feature, bugfix, refactor, or file modification, the agent MUST inspect `git status`, stage ALL modified and untracked files completely without missing any (`git add -A`), commit with a descriptive message, and push directly to GitHub (`git push origin main`).
- **Pre-Push Quality Verification**: Always test workspace builds (`npm run build:api`, `npm run build:web`) and verify PM2 process health (`pm2 status`) before committing and pushing updates to the main branch via git.
