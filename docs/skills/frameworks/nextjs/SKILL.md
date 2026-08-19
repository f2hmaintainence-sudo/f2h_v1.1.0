---
name: nextjs
description: Use when working in a Next.js application - adding routes, pages, layouts, route handlers, server actions, or data fetching, and when deciding what runs on the server versus the client. Covers detecting App Router versus Pages Router before creating files, the reserved file conventions, route groups and private folders, server and client component boundaries, caching and revalidation, streaming and loading states, server action security, the proxy file that replaced middleware, environment variable exposure, and image and font handling. Triggers on package.json containing next, on any file under app/ or pages/, or on mentions of server components, server actions, route handlers, or revalidation. Load with the react skill for component-level rules.
compatibility: For Next.js applications. Routing, caching, and file-convention behavior is strongly version-dependent - verify against the project's installed version.
metadata:
  category: framework
  version: "1.1.0"
---

# Next.js

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## Version context

Verified against Next.js 16.3.0 documentation on 2026-08-11.

Next.js changes routing, caching, and file conventions across majors more than most frameworks. **MUST** read the installed version from `package.json` and `package-lock.json` and verify version-sensitive behavior — especially caching defaults and file conventions — against the documentation for that version. Do not carry an assumption from an older major.

One rename to be aware of: **`middleware.ts` is deprecated and renamed to `proxy.ts` as of v16.0.0**, and Proxy now defaults to the Node.js runtime. A codemod exists (`npx @next/codemod@canary middleware-to-proxy .`). In a pre-16 project the file is still `middleware.ts` — follow what the project has.

## Detect before writing

**MUST** establish all of these before creating any file:

- **Router**: does `app/` exist, `pages/`, or both? They can coexist, but a feature MUST NOT be split across them.
- **`src/` directory**: is application code under `src/` or at the root? Place new files accordingly.
- **Organization strategy**: are project files inside `app/`, in root-level folders, or split per route segment? Next.js is unopinionated here, so the existing choice is authoritative.
- **Data fetching pattern**: server components fetching directly, route handlers, server actions, or a client-side library.
- **Existing `proxy.ts` / `middleware.ts`**, and what it matches.

## This workspace (apps/web)

Next.js 16 with the App Router, React 19, served in production by PM2 (`frontend-f2hfresh` runs
`next` from the root `node_modules/.bin`, not a standalone build).

```
apps/web/src/
  app/(landing)/   public marketing pages
  app/(auth)/      sign-in and registration
  app/(panel)/     authenticated operator surfaces (admin, branch, inventory, developer)
  app/appapk/      static download route
  proxy.ts         edge proxy — Next 16's rename of middleware.ts
  components/  hooks/  context/  services/  lib/  types/  constants/
```

- Route groups in parentheses **do not appear in the URL** — `(panel)/admin/...` serves `/admin/...`.
  Use them to attach a different `layout.tsx`, never to shorten a path.
- A page belongs in the group whose layout and auth posture it shares. A public page placed under
  `(panel)` inherits the authenticated shell; that is a routing bug, not a styling one.
- Components are grouped by surface under `src/components/` (`landingf2h/`, `admin/`, `inventory/`,
  `shared/`). Anything used by two surfaces moves to `shared/`.
- The API is a separate deployable. Call it over HTTP through `src/services/`; **NEVER** import from
  `apps/api` by relative path.
- Build gate: `npm run build:web` from the repo root. See `git-workflow`.

## Reserved file conventions

These names are fixed and case-sensitive. They are not style choices and MUST NOT be renamed or invented:

| File | Purpose |
|---|---|
| `layout` | Shared UI wrapping a segment and its children |
| `page` | Makes a route publicly accessible |
| `loading` | Suspense boundary for the segment |
| `error` | Error boundary for the segment |
| `global-error` | Root-level error boundary |
| `not-found` | Not-found UI |
| `route` | API endpoint (route handler) |
| `template` | Layout that remounts on navigation |
| `default` | Parallel-route fallback |

Directory conventions, also fixed:

```
[slug]        dynamic segment
[...slug]     catch-all
[[...slug]]   optional catch-all
(group)       route group, excluded from the URL
_folder       private folder, opted out of routing
@slot         named slot for a parallel route
(.)folder     intercepting route
```

Rules that follow from this:

- A route is **not publicly accessible** until it contains `page` or `route`. Other files can therefore be safely colocated inside `app/` without becoming routable.
- **Route directory names appear in the URL.** Use `kebab-case` for them. Non-route directories follow the repository's file convention — see the `naming-conventions` skill.
- Use a **route group** to organize or to apply a layout to a subset of routes without changing URLs. Use a **private folder** for colocated non-routable code.
- Render order within a segment is `layout` → `template` → `error` → `loading` → `not-found` → `page`. A `loading` file placed at the wrong level applies to more routes than intended; scope it with a route group.

## Server and client boundary

This is where most Next.js defects originate.

- Components are **server components by default** in the App Router. `'use client'` marks a boundary: that module **and everything it imports** becomes part of the client bundle.
- **MUST** push `'use client'` as far down the tree as possible. Marking a layout or page as a client component pulls its whole subtree to the client and forfeits server rendering.
- **NEVER** import server-only code into a client component — database clients, ORM instances, secret-reading modules, filesystem access. Enforce this with a server-only marker package where the project uses one.
- Props crossing the server-to-client boundary MUST be serializable. Functions, class instances, and Dates-as-class do not cross; server actions are the exception.
- **Minimize what crosses the boundary.** Passing a whole record to a client component that needs two fields ships the rest of it — including fields the user should not see — into the HTML payload.

Choose a client component only for what genuinely needs it: state, effects, event handlers, browser APIs, or a client-only library.

## Data fetching

- Fetch in **server components** by default, close to where the data is used. Request-level deduplication means two components fetching the same thing is not automatically two requests — but verify how your version handles it.
- **Parallelize independent fetches.** Sequential awaits of unrelated data is the most common Next.js performance defect. Start both promises, then await them together.
- Avoid waterfalls created by fetching in a parent purely to pass an id to a child. Restructure so each component fetches what it needs, or fetch both in parallel above.
- Use `loading` files and Suspense boundaries to **stream** rather than blocking the whole page on the slowest query.
- **MUST** treat caching and revalidation defaults as version-specific. Read the documentation for the installed version before relying on whether a fetch or a route is cached, and set the intent explicitly rather than depending on a default you remember.

See the `performance` skill for the general waterfall and round-trip rules.

## Route handlers and server actions

Both are public HTTP entry points. Treat them as such.

- **MUST** validate input in every route handler and server action. A server action is not privileged because it is called from your own component — it compiles to a POST endpoint any client can call directly with any payload.
- **MUST** re-check authentication and authorization inside every server action and route handler. The Next.js documentation is explicit that Proxy is not a sufficient authorization boundary: server functions are handled as POST requests to the route where they are used, so a matcher change or moving a function to another route can silently remove Proxy coverage.
- **NEVER** return internal errors, stack traces, or database errors from a handler. See the `api-design` skill.
- Revalidate affected caches after a mutating action, or the UI will show stale data.
- Route handlers are the right choice for webhooks, third-party callbacks, and non-form clients; server actions are the right choice for form submissions and mutations from your own UI.

## Proxy (formerly middleware)

- Runs before routes render, on **every request unless a matcher restricts it**. Without a matcher it also runs for static assets and image optimization — a redirect or auth check there will block CSS, JS, and images.
- Keep it to redirects, rewrites, headers, and cookies. It is not the place for database access or heavy logic.
- **NEVER** rely on shared module state or globals in it; it may run outside the application's main runtime.
- **NEVER** treat it as your only authorization layer. Enforce authorization where the data is accessed.

## Environment variables and secrets

- Variables prefixed to be publicly exposed are **inlined into the client bundle at build time**. They are public forever. **NEVER** put a secret, private key, or privileged token behind that prefix.
- Server-only variables MUST NOT be referenced from a client component; the value will be undefined or, worse, force the module into the bundle.
- **NEVER** commit `.env`, `.env.local`, or `.env.production`. Keep `.env.example` with placeholders.

See the `security` skill.

## Assets and metadata

- Use the framework's image component so images are sized, lazily loaded, and served in modern formats. Always set dimensions to prevent layout shift.
- Use the framework's font loading rather than a remote stylesheet, to avoid a render-blocking request and layout shift.
- Define metadata through the framework's metadata API or the file conventions (`icon`, `opengraph-image`, `sitemap`, `robots`) rather than hand-written tags.

## Validation gates

```
npm run lint
npm run build      catches server/client boundary and type errors that dev mode does not
npm run test
```

**MUST** run the production build before claiming a Next.js change works. Boundary violations, serialization errors, and missing environment variables frequently appear only there.

## Anti-patterns

| Anti-pattern | Correct approach |
|---|---|
| `'use client'` at the top of a layout or page | Push it to the smallest component that needs it |
| Importing a database client into a client component | Keep it server-side |
| Sequential awaits of independent data | Start both, await together |
| Fetching in a parent only to pass an id down | Fetch in parallel or per component |
| Server action without validation or an authorization check | Validate and authorize inside the action |
| Relying on Proxy alone for authorization | Enforce it where data is accessed |
| Proxy without a matcher | Scope it, or it runs on static assets too |
| A secret behind the public env prefix | Never; it ships to the browser |
| Passing an entire record to a client component | Pass only the fields it renders |
| Mixing App Router and Pages Router within one feature | Pick one per feature |
| Renaming or inventing a reserved file name | Use the exact convention |
| Assuming caching behavior from an older major | Verify against the installed version |
| Claiming success from `next dev` only | Run the production build |

## Related skills

- `react` — component, hook, and state rules.
- `frontend-engineering` — accessibility, UI states, forms.
- `performance` — waterfalls, bundle size, rendering cost.
- `security` — server action and route handler exposure.
- `api-design` — route handler contracts.
