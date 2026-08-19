---
name: naming-conventions
description: Use before naming or renaming any file, directory, class, function, variable, constant, database table, or column. Resolves naming by ecosystem rather than by personal preference - detect the language and framework first, then apply that ecosystem's standard, then the repository's established pattern. Covers PHP and PSR/PER, Laravel, TypeScript and JavaScript, Node.js, NestJS, React, Next.js, Dart and Flutter, and SQL identifiers, and explains how to decide when the project contradicts the ecosystem default. Load whenever a new file is created, a symbol is named, a rename is proposed, or a review questions a name. Prevents applying one language's file-naming style to another, such as kebab-case filenames in a PHP or Dart project.
metadata:
  category: foundation
  version: "1.1.0"
---

# Naming Conventions

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

There is no universal naming convention. A name is correct only relative to its ecosystem and its repository.

## Resolution order

**MUST** resolve in this order and stop at the first level that answers the question:

```
1. Existing repository convention   what neighbouring files and symbols already do
2. Framework convention             what the framework's own generators produce
3. Language / ecosystem standard    PSR/PER, Effective Dart, TypeScript norms
4. General engineering judgment     descriptive, unabbreviated, consistent
```

An established repository convention outranks the ecosystem default. Consistency inside one codebase is worth more than conformity to an external standard.

## Detect before naming

**MUST** establish the ecosystem before writing a filename:

| Signal | Ecosystem |
|---|---|
| `composer.json` | PHP — check `laravel/framework` for Laravel |
| `package.json` | Node/TypeScript — check for `next`, `@nestjs/core`, `react` |
| `pubspec.yaml` | Dart — check for `flutter` under dependencies |
| `tsconfig.json` | TypeScript is in use; check `strict` |
| `go.mod`, `Cargo.toml`, `pyproject.toml`, `*.csproj` | Go, Rust, Python, .NET |

Then list the directory you are adding to and read the names already there. **The neighbours are the specification.** A single existing file named `order_repository.dart` settles the question for the whole directory.

**NEVER** infer a project's convention from a single generated or vendored file (migrations, build output, `node_modules`, `vendor`, generated clients). Those follow tool conventions, not the project's.

## Ecosystem summary

Full tables, file-naming detail, and worked examples: [ecosystem naming reference](references/ecosystem-naming.md). Read it when working in an ecosystem you have not yet confirmed, or when a name spans layers (a model, its table, and its API field).

| Ecosystem | Files | Types / classes | Functions / members | Constants |
|---|---|---|---|---|
| PHP (PSR-1 / PER Coding Style) | `PascalCase.php`, matching the class name | `PascalCase` | `camelCase` | `UPPER_CASE`; enum cases `PascalCase` |
| Laravel | Framework's own: `OrderController.php`, `Order.php` | `PascalCase` | `camelCase` | `UPPER_CASE` |
| TypeScript / JavaScript | Repository's choice — see below | `PascalCase` | `camelCase` | `UPPER_SNAKE_CASE` or `camelCase` |
| NestJS | `orders.controller.ts`, `create-user.dto.ts` | `PascalCase` | `camelCase` | `UPPER_SNAKE_CASE` |
| React | `ProductCard.tsx` for components, `useCart.ts` for hooks | `PascalCase`; hooks `useX` | `camelCase` | `UPPER_SNAKE_CASE` |
| Next.js | Framework-reserved names are fixed (`page`, `layout`, `route`) | `PascalCase` | `camelCase` | `UPPER_SNAKE_CASE` |
| Dart / Flutter | `lowercase_with_underscores.dart` | `UpperCamelCase` | `lowerCamelCase` | `lowerCamelCase` — **not** `SCREAMING_CAPS` |
| SQL / relational schema | — | `snake_case` tables and columns | — | — |

Two consequences worth stating explicitly, because they are the most common cross-ecosystem mistakes:

- **NEVER** rename a PHP class file to lowercase or kebab-case. PSR-4 autoloading resolves the class from the file path; `order-service.php` will not autoload `OrderService`.
- **NEVER** apply JavaScript or PHP filename styles to Dart. Dart source files are `lowercase_with_underscores.dart` even though the classes inside them are `UpperCamelCase`.

## TypeScript and JavaScript file naming

The ecosystem has no single standard, so the repository's choice is authoritative. The four common styles:

```
user-service.ts      kebab-case      common in Node, NestJS, Next.js, Angular
userService.ts       camelCase       common in some React and Express codebases
UserService.ts       PascalCase      common where the file exports one class or component
user_service.ts      snake_case      uncommon; usually a port from another ecosystem
```

**MUST** determine which one the repository uses and follow it. **NEVER** introduce a second style. Mixed file-naming styles in one directory are a defect, and on case-insensitive filesystems they cause import failures that only appear in CI.

A frequent and acceptable hybrid: `PascalCase` for files whose default export is a component or class, `kebab-case` for everything else. If the repository does this, follow it exactly rather than "correcting" it.

## This workspace

Each app has already chosen a style. **MUST** follow the one for the app being edited; there is no
workspace-wide answer.

| Where | Style | Example |
|---|---|---|
| `apps/api` files | `kebab-case` with a role suffix | `profile.controller.ts`, `profile.service.ts`, `dto/profile.dto.ts` |
| `apps/web` components | `PascalCase` | `MapPicker.tsx`, `Breadcrumbs.tsx` |
| `apps/web` hooks | `camelCase`, `use` prefix | `useOrderSocket.ts` |
| `apps/mobile/*` | `snake_case` (Dart standard) | `customer_session_cubit.dart` |
| Route paths | lowercase `kebab-case` | `delivery-partner/profile` |
| Database columns | `snake_case` | `first_name`, `wallet_balance` |
| API response fields | `snake_case` | `branch_name`, `referral_code` |

The API returns `snake_case` because rows are spread from `pg` straight into the response. That is
now the contract — **MUST** keep it, and **MUST NOT** camelCase a field in one new endpoint. The
`api-design` skill owns the wire contract; changing it is a versioned, deliberate migration, not a
per-endpoint choice.

Route casing is a hard rule with an owner: see `api-design`.

## Naming across a boundary

The same concept legitimately has different names in different layers. **MUST** convert at the boundary rather than leaking one layer's style into another:

```
Database column    created_at        snake_case
Model property     createdAt         language convention
API field          created_at or createdAt   whichever the existing API already returns
```

**MUST** check what the existing API actually returns before choosing the wire format, and keep it consistent across every endpoint. See the `api-design` skill.

Never let a persistence detail dictate a domain name, or vice versa. If the column is `usr_flg_actv`, the model property is still `isActive`.

## Naming quality, independent of ecosystem

These apply in every language:

- Name for **what a thing is or does**, in the vocabulary the project already uses. If the codebase says `tenant`, never introduce `organization` for the same concept.
- Booleans read as assertions: `isActive`, `hasAccess`, `shouldRetry`. Avoid negated names.
- Include units and currency where ambiguity is possible: `timeoutMs`, `amountCents`, `sizeBytes`.
- Expand abbreviations unless the abbreviation is the domain's own term (`http`, `url`, `id`, `sku`). Treat multi-letter acronyms as words: `HttpClient`, not `HTTPClient`, in ecosystems whose style guides say so.
- **NEVER** encode type or implementation into a name (`strName`, `userArray`, `IUserInterface` in ecosystems that do not use that prefix — check whether yours does).
- **NEVER** put `new`, `old`, `final`, `v2`, `temp`, `copy`, or a date in a permanent name.

## Renaming existing code

- **NEVER** rename existing symbols or files as a side effect of another task. A rename touches every import and every open branch.
- Renaming is its own change, made only when it is the requested task or when the current name is actively wrong (it states something false).
- When renaming, update every reference including strings, config, routes, DI tokens, serialized data, and generated code. Verify by running the build and tests, not by text search alone.
- **NEVER** rename a database column, API field, event name, or queue name as a pure cleanup. Those are contracts with stored data and other systems. See `database` and `api-design`.

## Anti-patterns

| Anti-pattern | Correct approach |
|---|---|
| Applying one ecosystem's file style to another | Detect the ecosystem first |
| Introducing a second file-naming style into a directory | Match the neighbours |
| Renaming a PHP class file to kebab-case | PSR-4 requires the path to match the class |
| `SCREAMING_CAPS` constants in Dart | `lowerCamelCase` per Effective Dart |
| Renaming across a codebase to satisfy a preference | Leave it; consistency already exists |
| Naming a file after a layer when the project names by feature, or the reverse | Follow the project's pattern |
| Deriving a domain name from a legacy column name | Name the domain concept properly, convert at the boundary |

## Related skills

- `project-structure` — which directory the file belongs in.
- `clean-code` — the rest of the code's readability.
- `frameworks/*` — framework-specific file and class naming in practice.
- `database`, `api-design` — identifiers that are contracts rather than code.
