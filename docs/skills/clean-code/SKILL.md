---
name: clean-code
description: Use while writing or editing the body of any function, class, component, or module. Covers function size and single responsibility, cohesion and coupling, when duplication should and should not be removed, when an abstraction is premature, explicit dependencies over hidden ones, readable control flow and early returns, avoiding deep nesting, type safety without escape hatches, magic values, hidden side effects, dead code, PostgreSQL parameter binding ($1, $2), database single source of truth joins, kebab-case API routes, and comments that explain why rather than what. Triggers on writing a new function or component, editing existing logic, "clean this up", "make this readable", reviewing naming, or deciding whether to extract a helper, a base class, or a shared abstraction. Not for casing or file-naming conventions (naming-conventions), file placement (project-structure), or layering (architecture).
metadata:
  category: foundation
  version: "1.2.0"
---

# Clean Code

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

Match the surrounding code first. Every rule below yields to an established project convention that contradicts it — consistency is worth more than any individual improvement.

## Project Rules & Architecture Conventions

All clean code in this codebase MUST comply with the following core project conventions:

1. **REST API Route Endpoints**:
   - **MUST** use lowercase `kebab-case` for all route roots and endpoint paths (`@Controller({ path: 'delivery-partner/profile', version: '1' })`).
   - **NEVER** use CamelCase or PascalCase in route definitions (`DeliveryPartner/profile`).
   - **MUST** maintain backward compatibility for legacy endpoint updates using array routing: `@Controller({ path: ['delivery-partner/auth', 'DeliveryPartner/auth'], version: '1' })`.

2. **Database Schema & SQL Conventions**:
   - **MUST** treat the `users` table as the Single Source of Truth for identity fields (`first_name`, `last_name`, `phone`, `email`, `user_name`).
   - **Satellite Tables** (`customers`, `delivery_partners`) MUST store only domain-specific extension fields (e.g. `wallet_balance`, `is_active`, `vehicle_type`).
   - **MUST** explicitly `JOIN users u ON u.user_id = profile.id` when querying identity data alongside domain profiles. NEVER attempt to query identity columns from satellite tables directly.
   - **MUST** use PostgreSQL positional parameter placeholders (`$1`, `$2`, `$3`). NEVER use MySQL `?` placeholders or string concatenation.

3. **Deployment & Process Verification**:
   - **MUST** test workspace build (`npm run build:api`, `npm run build:web`) and verify PM2 process health (`pm2 status`) before pushing updates.

These three are restated here because they constrain code you are writing right now. Their owners
hold the full rule and the exceptions: routes → `api-design`, SQL and schema → `database`, the build
gate → `git-workflow`. When one changes, it changes there first.

---

## Naming & Intent

Casing, file names, and ecosystem rules are owned by the `naming-conventions` skill. Two rules belong here because they govern intent and behavioral honesty:

- **A name MUST NOT lie about what the code does.** Functions with side effects take verbs that admit them: `saveOrder`, `sendInvoice`. A name like `getUser` MUST NOT mutate state, and `validateInput` MUST NOT perform database writes.
- Short names are fine for short lifetimes (`i` in a loop, `e` in a one-line handler). Length SHOULD scale with scope.

---

## Function Size & Single Responsibility (SRP)

A function SHOULD do one thing at one level of abstraction. Practical signals it is doing more:

- You cannot name it without "and", or you name it `handleX`/`processX` because nothing narrower fits.
- It mixes decision-making, I/O, business logic, and response formatting in one body.
- You must read the entire body to discover whether it mutates state or triggers side effects.
- The test suite requires elaborate mocks for behavior that is conceptually simple.

Split on those signals, not on line count. Splitting a coherent 60-line function into six single-use helpers called only in sequence makes code harder to navigate, not easier.

---

## Control Flow & Readability

- **Return early.** Handle guards, invalid input, and edge cases at the top, then let the main path run unindented.
- Nesting deeper than **three levels** SHOULD be flattened — by early return, by extracting the inner block, or by inverting the condition.
- Prefer positive conditions. `if (isValid)` reads better than `if (!isInvalid)`.
- Keep the happy path visually dominant; error handling belongs at the edges of the body, not woven through it.
- **NEVER** rely on subtle execution ordering, implicit type coercion, or fall-through that a reader must infer.

```typescript
// Good: Early returns, flat structure, clear happy path
async function processOrder(orderId: string): Promise<OrderResult> {
  const order = await findOrderById(orderId);
  if (!order) {
    throw new NotFoundException(`Order ${orderId} not found`);
  }
  if (!order.isPayable()) {
    throw new BadRequestException(`Order ${orderId} cannot be processed`);
  }

  return await executePayment(order);
}
```

---

## Duplication & Abstraction (DRY)

Do not apply DRY mechanically. Duplicate code that is *coincidentally* similar and duplicate code that is *necessarily* identical look the same and must be treated differently.

**Before creating an abstraction, all three MUST hold:**

1. **The behavior is genuinely repeated** — the same rule, not merely similar structural shapes. Two payloads with identical fields today for unrelated business reasons are not duplication.
2. **The abstraction has a stable, nameable responsibility.** If you cannot name it without listing callers, or the name contains "Generic"/"Base"/"Common" with no narrower meaning, it is not ready.
3. **It reduces total complexity rather than relocating it.** An abstraction that needs flags, mode parameters, or optional callbacks to serve its callers has moved the branching, not removed it.

Practical default: **wait for the third occurrence.** Two occurrences give no evidence about which parts vary.

**Keep duplication when:**
- The copies serve different owners/domains and are likely to diverge over time.
- Removing duplication forces a parameter that exists only to select internal behavior.
- The duplicated snippet is short and reads clearly in place.

---

## Dependencies & Side Effects

- Dependencies SHOULD be explicit: passed in as arguments or injected via constructors. Reaching out to global variables, singletons, mutable module-level variables, or ambient config deep inside a function makes code untestable.
- **NEVER** hide a side effect behind a getter or reader name — no database writes inside a reader, no network calls inside a constructor, no cache mutation inside a pure transform.
- Non-determinism (current time, randomness, environment variables, network calls) SHOULD enter through arguments or injected services so behavior is reproducible in tests.
- Prefer returning new values over mutating input parameters. If a function mutates what it was given, its name MUST explicitly state so (`mutateUserRoles`).

---

## Type Safety & Escape Hatches

- Use the project's type system to model actual runtime possibilities. Prefer explicit union types and enums over generic `string` or `number`.
- Make illegal states unrepresentable where possible — a type structure that cannot express an invalid combination beats a runtime check that developer might forget.
- **NEVER** use `any`, unchecked type assertions (`as unknown as T`), `@ts-ignore`, `eslint-disable`, or equivalent escape hatches to silence compiler errors. Fix the underlying type or narrow it with runtime validation.
- Validate data crossing trust boundaries (network inputs, HTTP bodies, database queries, file reads) at the boundary, then trust the strongly-typed value inward.

---

## Error Handling Discipline

- Handle errors where you can take meaningful recovery action. Everywhere else, allow them to propagate up.
- **NEVER** swallow an error silently — no empty `catch` blocks, no bare `try { ... } catch {}`, no ignored promise rejections.
- Preserve the underlying cause when wrapping errors, and attach relevant context (record ID, operation name, failed parameter).
- **Fail fast** on programmer errors (violated invariants, impossible states). Handle expected operational failures (missing record, timeout, invalid client input) as normal domain control flow.
- Error messages MUST NOT leak sensitive data (database passwords, tokens, API keys, personal details).

---

## Magic Values & Constants

- **NEVER** leave unexplained literal values in business logic (`if (status === 7)`, `sleep(86400)`). Every magic value MUST be assigned a descriptive named constant or enum.
- Define constants near where they are used unless shared across the module/domain.
- Self-evident literals (`0`, `1`, `""`, `2` in a division by half) do not require named constants.
- Environment-dependent configuration MUST NOT be hardcoded — load it through the project's configuration service or environment manager.

---

## Comments & Documentation

- Comment **why**, not *what*. Code shows what is happening; comments explain why a non-obvious choice or workaround was selected.
- Worth commenting: non-obvious algorithms, external constraints/workarounds, bug fix references, trade-offs made.
- **NEVER** write comments that restate the code (`// increment i`), commented-out blocks of dead code, or inline changelogs — Git tracks history.
- **MUST** update comments whenever the code they describe changes. Stale comments are worse than no comments.

---

## Dead Code Elimination

- Delete unused functions, unreachable branches, unused parameters, unused imports, and commented-out code blocks. Version control retains full history.
- **Exception**: Exported library code or public API contracts consumed outside the workspace repository. Confirm non-usage across external callers before removal.

---

## Related Skills

- `naming-conventions` — casing, file naming, and ecosystem rules.
- `api-design` — API endpoint contracts, versioning, and validation.
- `database` — schema single source of truth, queries, parameter binding.
- `architecture` — layer separation and dependency inversion.
- `testing` — unit, integration, and end-to-end testing practices.
- `code-review` — guidelines for reviewing diffs against clean code standards.
