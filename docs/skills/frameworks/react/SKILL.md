---
name: react
description: Use when writing or changing React components, hooks, context, or component-level state. Covers component boundaries and composition instead of boolean prop proliferation, deriving state rather than duplicating it, correct and unnecessary uses of effects, the rules of hooks, keys and list rendering, context scope and re-render cost, memoization applied to measured cost, refs, error boundaries, and the React 19 API changes including ref as a prop, Context used directly as a provider, useActionState, useOptimistic and the use hook. Triggers on package.json containing react, on any .jsx or .tsx component file, or on mentions of hooks, props, state, context, memo, or effects. Load with the nextjs skill when the project uses Next.js, and with frontend-engineering for accessibility and UI states.
compatibility: For React applications. Verify version-specific APIs against the project's installed React version.
metadata:
  category: framework
  version: "1.0.0"
---

# React

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## Version context

Verified against React 19.x (latest 19.2.8) on 2026-08-11.

**MUST** read the installed React version from `package.json` before using a version-specific API. Several React 19 changes alter what correct code looks like:

| Change | Consequence |
|---|---|
| `ref` is passed as a normal prop to function components | `forwardRef` is no longer needed and is deprecated |
| `<Context>` works directly as a provider | `<Context.Provider>` is legacy style |
| `useFormState` renamed to `useActionState` | Use the new name |
| `ref` callbacks may return a cleanup function | Cleanup replaces null-call on unmount |
| `use()` reads a promise or context during render | Enables conditional context reads and promise unwrapping |
| Metadata tags (`title`, `meta`, `link`) hoist from components | No separate head-management library needed |
| `useDeferredValue` accepts an initial value | Simplifies first-render deferral |

In a React 18 project, `forwardRef` and `<Context.Provider>` remain correct. **Follow what the project's version supports and what its existing code does** — do not mix both styles in one codebase.

## Detect before writing

- React version, and whether TypeScript is used with `strict`.
- The existing component library — **search it before building any UI element.** Buttons, modals, inputs, tables, and empty states almost always already exist.
- State management: local state, context, or a library. Do not introduce a second one.
- Data fetching: a library, server components, or hand-rolled effects.
- File and component naming, and whether components live one-per-file or grouped.

## Composition over configuration

When to split a component, and how large it should be, is owned by the `frontend-engineering` skill. The React-specific expression of it is composition:

When a component accumulates boolean props (`isCompact`, `hasIcon`, `showHeader`, `variantSmall`), each one multiplies the internal branching and the states nobody tests. Accept children or slots and let the caller compose:

```
Instead of  <Card hasHeader hasFooter isCompact showBadge />
prefer      <Card><Card.Header/><Card.Body/><Card.Footer/></Card>
```

A component whose props are mostly booleans that gate markup is a signal to invert to composition. This matters more as a codebase grows, because each new boolean is a permanent branch.

## State mechanics

Which scope state belongs in — local, lifted, URL, or global — is owned by the `frontend-engineering` skill. What belongs here is how React's model behaves:

- **NEVER duplicate state that can be derived.** Compute it during render. A second stored copy falls out of sync, and syncing it with an effect makes it worse.
- **NEVER copy props into state** unless you deliberately want an initial value that then diverges — and name it so that is obvious.
- Use functional updates (`setCount(c => c + 1)`) when the next value depends on the previous one. Reading the current value from the closure is stale under batching.
- State updates are asynchronous; the variable does not change on the line after you set it.
- For several values that change together under defined transitions, a reducer is clearer than multiple `useState` calls.
- Treat state as immutable. Mutating an object or array in place does not trigger a render; create a new value.

## Effects

Most effects in real codebases should not exist. Before writing one, check whether it is one of these:

| You are doing this in an effect | Do this instead |
|---|---|
| Computing a value from props or state | Derive it during render |
| Resetting state when a prop changes | Give the component a `key` so it remounts |
| Responding to a user interaction | Put the logic in the event handler |
| Notifying a parent of a change | Call the callback in the handler that caused it |
| Chaining state updates | Compute the whole next state at once |
| Fetching data | Use the project's data-fetching layer or a server component |

An effect is correct for **synchronizing with something outside React**: a subscription, a browser API, a non-React widget, an imperative animation, a manual event listener.

When you do write one:

- **MUST** include every reactive value it reads in the dependency array. **NEVER** silence the lint rule — an omitted dependency is a stale-closure bug waiting to happen. Restructure instead: move the value inside, extract a stable function, or use a ref for values that should not retrigger.
- **MUST** return a cleanup function for anything that subscribes, listens, opens, or schedules. Effects re-run and components unmount.
- Guard against a resolved request from a stale render overwriting newer state — track cancellation in the cleanup.

## Rules of hooks

- **MUST** call hooks at the top level of a component or another hook — never inside a condition, loop, early return, or nested function. React identifies hooks by call order.
- Custom hooks MUST start with `use`, or the linter cannot enforce the rules on them.
- **SHOULD** extract stateful logic used in more than one place into a custom hook rather than duplicating it. A custom hook is the right home for logic that is neither presentation nor pure computation.
- Keep the project's React ESLint configuration enabled. It catches the majority of hook defects.

## Lists and keys

- **MUST** give list items a stable, unique key derived from the data — a domain id.
- **NEVER** use the array index as a key when the list can reorder, filter, or have items inserted or removed. React will reuse the wrong element's state, producing wrong values in inputs and misplaced animations.
- **NEVER** use a random value or a value regenerated each render — it destroys and recreates every item on every render.
- A `key` is also the correct tool for **forcing a remount** to reset state when identity changes.

## Context

- Context solves prop drilling. It is **not** a state manager and not a performance optimization.
- **Every consumer re-renders when the context value changes.** Split unrelated concerns into separate contexts rather than one large object, and keep frequently-changing values out of a context that stable components consume.
- **MUST** memoize a context value that is an object or array created during render, or every consumer re-renders on every parent render.
- Prefer passing state down one or two levels directly. Context earns its cost across a real distance.

## Memoization

Apply to a **measured** cost, not preemptively.

- `memo` helps only when the component re-renders often with equal props. It adds a comparison on every render and is defeated by a new object, array, or inline function prop.
- `useMemo` is for genuinely expensive computation, or for referential stability that something downstream depends on. Memoizing a cheap expression costs more than it saves.
- `useCallback` matters when the function is a dependency of an effect or a prop to a memoized child.
- **NEVER** wrap everything in memoization as a habit. It obscures the code, adds bugs through wrong dependencies, and usually addresses nothing measurable.
- Prefer restructuring first: move state down, lift static content out, split the component. That removes re-renders instead of comparing around them.

Where the project uses the React compiler, manual memoization is largely unnecessary — check before adding it.

## Refs and imperative code

- Refs are for values that do not trigger renders and for reaching DOM nodes. **NEVER** read or write a ref during render for anything that affects output.
- In React 19, accept `ref` as a normal prop on function components. In React 18 and earlier, use `forwardRef`.
- Prefer declarative rendering over imperative DOM manipulation. Reach for a ref for focus management, measurement, media control, and integrating non-React libraries.

## Errors

- Wrap independently-failing regions in an error boundary so one failure does not blank the page.
- Error boundaries do **not** catch errors in event handlers, async callbacks, or effects' async work. Handle those explicitly.
- Show a recoverable error state with a next action, never a raw exception. See the `frontend-engineering` skill.

## Forms and transitions

- For form submission and mutation state, prefer the platform-aligned APIs the installed version provides — `useActionState` for submission state and result, `useFormStatus` for pending state inside a nested submit control, `useOptimistic` for optimistic UI — over hand-rolled loading booleans.
- Mark non-urgent updates as transitions so typing and interaction stay responsive during expensive renders.
- Client-side validation is feedback; the server MUST validate independently. See the `security` skill.

## Anti-patterns

| Anti-pattern | Correct approach |
|---|---|
| State derived from other state, synced by an effect | Derive during render |
| Effect that computes a value from props | Compute it in the render body |
| Effect used to fetch on mount | The project's data-fetching layer |
| Disabling the exhaustive-dependencies lint rule | Restructure so the dependency is correct |
| Array index as a key in a mutable list | A stable id from the data |
| Unmemoized object as a context value | Memoize it |
| One large context for unrelated concerns | Split by concern |
| Memoizing everything by default | Measure, then memoize |
| Accumulating boolean props to configure markup | Compose with children or slots |
| Business rules implemented only in a component | Move them server-side or into a tested module |
| Mutating state directly | Create a new value |
| Mixing `forwardRef` and ref-as-prop in one codebase | Follow the version and the existing style |
| Duplicating an existing component instead of extending it | Extend, or add a variant |

## Related skills

- `frontend-engineering` — accessibility, loading and error states, forms, responsiveness.
- `nextjs` — server and client boundaries, routing, data fetching.
- `performance` — measuring render and bundle cost.
- `naming-conventions` — component, hook, and file naming.
- `testing` — testing by user-visible behavior, not internals.
