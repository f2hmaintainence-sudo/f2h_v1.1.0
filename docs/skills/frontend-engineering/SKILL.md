---
name: frontend-engineering
description: Use when building or changing user interface code - components, views, screens, pages, styles, or client-side state. Covers component boundaries and size, where state belongs, server versus client responsibilities and data fetching, keyboard and screen-reader accessibility, handling loading, empty, and error states, form validation and submission, responsive behavior, perceived performance, and keeping business rules out of presentation code. Triggers on "build this component", "add a page or screen", "fix the layout", "this UI is slow", form work, styling changes, or client-side state management. Framework-agnostic - adopt whatever framework, styling approach, and state library the project already uses rather than introducing another, and load the matching frameworks skill for React, Next.js, or Flutter specifics.
metadata:
  category: domain
  version: "1.0.0"
---

# Frontend Engineering

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## First: adopt the existing stack

**MUST** determine before writing any UI code: the framework and its version, the styling approach (utility classes, CSS modules, styled components, plain CSS), the component library if any, the state and data-fetching approach, and the routing model.

**NEVER** introduce a second framework, styling system, component library, or state management library into a project that has one. If the existing approach genuinely cannot express what is needed, say so and ask.

**MUST** search the existing component library before building any UI element. Buttons, modals, inputs, tables, toasts, date pickers, and empty states almost always already exist. A duplicate component is a permanent inconsistency — two things that look almost alike and diverge with every change.

Extend an existing component with a new variant rather than copying it. Copy only when the variants would make the original incoherent.

## Component boundaries

- A component SHOULD have one responsibility and a name that states it.
- Split when it renders several unrelated regions, when it holds state for unrelated concerns, when props exist only to switch between modes, or when you cannot describe it in one sentence.
- **Do not split for size alone.** A long component rendering one coherent thing is easier to read than six fragments that are only ever composed in one order.
- Keep props explicit and minimal. A component taking a whole domain object to read two fields is coupled to a shape it does not need.
- **NEVER** introduce a "generic" component parameterized by flags to serve several unrelated screens. That moves branching, it does not remove it. See the `clean-code` skill.

Prefer separating **presentation** (renders what it is given) from **container** logic (fetches, decides, coordinates) where the project already does. Presentational components are far easier to reuse and test.

## Where logic lives

- **Business rules belong on the server**, or at minimum in a non-presentational module. Pricing, eligibility, permissions, and workflow transitions MUST NOT be implemented only in the UI — the client is not a trust boundary, and duplicating the rule guarantees divergence.
- The UI may **mirror** a server rule for immediate feedback. The server MUST still enforce it. See the `security` skill.
- Non-trivial derivation, formatting, and validation logic SHOULD live in plain testable functions outside the component, not inline in markup.

## State

Pick the narrowest scope that works. Escalate only when a real need appears.

| State | Keep it in |
|---|---|
| Used by one component | Local component state |
| Shared by a few nearby components | Lifted to the closest common parent |
| Server data (fetched, cached, refetched) | The project's data-fetching layer — **not** global UI state |
| Genuinely global UI concerns (theme, session, locale) | Shared context or store |
| Belongs in the URL (filters, tab, page, selection) | The URL |

Rules:

- **NEVER** copy server data into global client state and mutate both. It creates two sources of truth that silently drift.
- **NEVER** duplicate state that can be derived. Compute it during render; a second stored copy will fall out of sync.
- State a user would expect to survive a refresh or a shared link (current filter, page, tab) SHOULD live in the URL.
- Keep effects for genuine synchronization with outside systems. An effect that only recomputes a value from props belongs in a derivation.

## The four states of every data-driven view

**MUST** handle all four. Shipping only the success case is the most common UI defect.

1. **Loading** — a skeleton or spinner that does not shift layout when content arrives. For actions, disable the control and show progress so it cannot be double-submitted.
2. **Empty** — say what would appear here and how to get there. A blank region reads as broken.
3. **Error** — say what failed in the user's terms, and offer the next action (retry, go back, contact support). **NEVER** show a raw exception, stack trace, or status code as the whole message.
4. **Success** — the actual content.

Also handle partial and stale states where they apply: some data loaded, background refresh, offline.

## Forms

- Validate on the client for **fast feedback**; the server MUST validate independently for correctness and security.
- Show errors next to the field they concern, in plain language that says how to fix it.
- Validate a field on blur or on submit, not on every keystroke of a first attempt — errors appearing while typing are hostile.
- Preserve what the user entered when submission fails. **NEVER** clear a form on error.
- Disable the submit control while in flight and guard against double submission on the server too. See idempotency in the `api-design` skill.
- Associate every input with a `<label>`, mark required fields, and link error messages to their inputs so assistive technology announces them.
- Never block paste, and never impose maximum lengths on passwords.

## Accessibility

Non-negotiable baseline:

- **Use semantic elements.** A `<button>` for actions, `<a href>` for navigation, real headings in order, `<form>` for forms, lists for lists. A `div` with a click handler is invisible to keyboard and screen-reader users. Semantic HTML provides focus, keyboard behavior, and roles for free; ARIA reimplements them badly.
- **Everything interactive MUST be keyboard operable** — reachable by Tab, activated by Enter/Space, and dismissible by Escape where a dismissal exists. Test by unplugging the mouse.
- **Focus MUST be visible.** Never remove focus outlines without an equally clear replacement.
- Manage focus on route change, modal open (trap inside, return on close), and dynamic content insertion.
- Every image needs `alt` — descriptive when meaningful, empty when decorative. Every input needs a programmatic label. Icon-only buttons need an accessible name.
- Never convey meaning by color alone. Maintain sufficient text contrast.
- Announce asynchronous changes (validation errors, toasts, results) via a live region; otherwise they are silent to screen readers.
- Respect reduced-motion preferences.

## Responsive behavior

- Follow the project's existing breakpoints and layout primitives. Do not introduce new ones.
- Design content-first: let layout adapt to content rather than pinning to device sizes.
- Interactive targets need adequate touch size and spacing.
- Verify content that overflows on small screens — tables, long words, wide code blocks — has a scroll or wrap strategy. The page body should not scroll horizontally.
- Test the actual small-viewport rendering rather than assuming.

## Perceived performance

Measurement, bundle size, rendering cost, and waterfalls are owned by the `performance` skill. What belongs here is what the user experiences:

- **Never block the whole view on the slowest piece of data.** Render what is ready and stream or defer the rest.
- **Reserve space for content that loads late** so the layout does not jump. Shifting content is the most disruptive perceived-performance defect.
- **Respond to input immediately**, even when the result is not ready: disable the control, show progress, or apply an optimistic update.
- **Debounce input-driven requests**, and cancel superseded ones so an older response cannot overwrite a newer one.

## Client-side security

- Anything shipped to the browser is public — **NEVER** put a secret, private key, or privileged token in client code or a build-time variable that gets inlined.
- Render untrusted content through the framework's escaping. Raw-HTML injection sinks require sanitizing with a maintained library. See the `security` skill.
- Client-side route guards are user experience, not access control. The server MUST enforce authorization.

## Related skills

- `frameworks/react`, `frameworks/nextjs`, `frameworks/flutter` — framework-specific component and rendering rules.
- `performance` — measuring bundle, render, and request cost.
- `clean-code` — component internals and abstraction timing.
- `security` — XSS, client-side trust boundaries.
- `api-design` — the contracts the UI consumes.
- `testing` — testing by user-visible behavior rather than internals.
