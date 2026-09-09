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

## 3. Mandatory Git Synchronization & Deployment Lifecycle
- **Mandatory Git Pull at Task Start**: At the start of EVERY task, conversation, or before inspecting/modifying any files, the agent MUST run `git pull origin main` to ensure the local workspace is 100% up-to-date with GitHub.
- **Complete Git Auto-Push on Every Change**: Upon completing ANY task, feature, bugfix, refactor, or file modification, the agent MUST inspect `git status`, stage ALL modified and untracked files completely without missing any (`git add -A`), create a descriptive commit, and push directly to GitHub (`git push origin main`).
- **Pre-Push Quality Verification**: Always test workspace builds (`npm run build:api`, `npm run build:web`) and verify PM2 process health (`pm2 status`) before committing and pushing updates to the main branch via git.

## 4. Database Version Controlling & Schema Evolution Rules
- **No In-Place Edits to Applied Migrations**: Once a migration file exists in `apps/api/migrations/`, it MUST NOT be edited or deleted. Always use `npm run db:create-migration <name>` to generate a new forward migration.
- **Backward Compatibility for Production Hosting**: All schema modifications MUST preserve existing production records (`f2hfresh.com` / `f2h_fresh`). 
- **Expand-and-Contract Lifecycle**:
  - New columns MUST be `NULLABLE` or have a `DEFAULT` value.
  - Never drop or rename a column in one step. Follow Expand -> Backfill -> Deprecate -> Contract.
- **Mandatory Pre-Hosting Backups**: Always run `./scripts/db-backup.sh <dbname>` before deploying migrations or hosting updates on live production.
- **Development Data Synchronization (Never Overwrite Prod)**: During development cycles, use `npm run db:clone-prod-to-dev` to safely refresh `f2h_dev` with production data. Production `f2h_fresh` MUST NEVER be overwritten with development data; at go-live, only forward migrations are applied to `f2h_fresh`.
- **Documentation Reference**: Detailed operational instructions live in `docs/DATABASE_VERSION_CONTROL.md`.
