---
name: styling-css-tailwind
description: Use when writing or changing styles, layout, or theming in a user interface. Covers detecting the project's existing styling approach before adding any, layout with flexbox and grid, responsive design driven by content rather than device sizes, design tokens for color spacing and type, dark mode and theme switching, CSS Modules and scoped styles, cascade and specificity control, and Tailwind CSS conventions including the v4 CSS-first configuration. Triggers on any CSS, SCSS, or style file, a Tailwind config or directive, class attribute changes, "fix the layout", "make it responsive", "add dark mode", "style this component", or theme and token work. Load with frontend-engineering for accessibility and component structure.
compatibility: Tailwind CSS v4 differs substantially from v3. Verify the installed major version before applying any Tailwind-specific rule.
metadata:
  category: domain
  version: "1.0.0"
---

# Styling and CSS

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## Detect the existing approach first

**MUST** establish which of these the project uses before writing a single style:

| Signal | Approach |
|---|---|
| `tailwindcss` in the manifest | Tailwind — check the major version |
| `*.module.css`, `*.module.scss` | CSS Modules |
| A CSS-in-JS library in the manifest | Runtime or compiled CSS-in-JS |
| Plain `.css` / `.scss` with global class names | Conventional CSS, possibly BEM |
| A component library in the manifest | Its theming system governs |

**NEVER** introduce a second styling system. A project with Tailwind does not get a stylesheet of hand-written utility classes; a project with CSS Modules does not get inline styles. Mixed styling systems produce specificity conflicts that are extremely expensive to unpick.

**MUST** search the existing styles for a token, variable, or utility that already expresses what you need. Duplicated colors and spacing values are the most common styling defect, and each duplicate is a permanent inconsistency.

## Design tokens

Style from a defined set of values, never from ad-hoc numbers.

- **MUST** use the project's existing tokens for color, spacing, type scale, radius, shadow, and breakpoints. A hardcoded `#3b82f6` or `13px` where a token exists is a defect.
- When a value genuinely does not exist yet, add it to the token layer rather than inlining it, so the next use finds it.
- Define semantic tokens on top of primitives: `--color-surface`, `--color-text-muted`, `--color-danger` rather than `--blue-500` used directly at call sites. Semantic names survive a palette change; primitive names do not.
- Keep the scale small. A spacing scale with 30 values is not a scale.

## Layout

- Use **flexbox** for one-dimensional arrangement and **grid** for two-dimensional layout. Reaching for absolute positioning to solve an ordinary layout is a signal the wrong primitive was chosen.
- Prefer logical properties (`margin-inline`, `padding-block`, `inset-inline-start`) over physical ones where the project may support right-to-left languages.
- Use gap for spacing between siblings rather than margins on children — it does not collapse and does not leave a trailing edge.
- **NEVER** set a fixed height on a container whose content can grow. Text scales, translations are longer, and users change font size. Use minimum heights and let content determine the rest.
- Avoid `z-index` arms races. Define a small set of named layers in the token layer and use those values only.

## Responsive design

- **Design from the content outward.** Add a breakpoint where the layout actually breaks, not at a device width. Device-specific breakpoints go stale as hardware changes.
- **MUST** use the project's existing breakpoints. Do not introduce new ones for one component.
- Prefer intrinsic techniques that need no breakpoint at all: fluid type with clamped bounds, `minmax()` grid tracks, auto-fitting columns, and wrapping flex containers. A layout that adapts without media queries has fewer states to test.
- Build mobile-first where the project does, so styles add capability rather than undo it.
- **MUST** verify small viewports actually work rather than assuming. Wide tables, long unbroken strings, and fixed-width media are the usual causes of horizontal overflow. Wide content scrolls inside its own container; **the page body must never scroll horizontally.**
- Respect safe areas on devices with insets, and test at a large system font scale.

## Dark mode and theming

- **MUST** follow the project's existing mechanism — a class or attribute on the root element, a media query, or both. Do not add a second.
- Theme by **redefining tokens**, not by overriding component styles. One block of token overrides per theme; component styles reference tokens and stay theme-agnostic.
- Support three states when the project offers a toggle: explicit light, explicit dark, and follow-the-system default. Define the complete default palette unconditionally, then override only what changes per theme. **NEVER** give a color its only definition inside a media query or a theme block — anything not covered by that block will be unstyled.
- Dark mode is not an inversion. Reduce contrast of large surfaces, avoid pure black and pure white, and re-check that every state (disabled, error, focus) is still distinguishable.
- **MUST** re-verify contrast in both themes. A pairing that passes in light frequently fails in dark. See the `frontend-engineering` skill.
- Set a background color explicitly on the root element in both themes; a transparent background borrows whatever is behind it.

## Scoped styles and the cascade

- Prefer scoped styles — CSS Modules, component-scoped blocks, or utilities — over global class names. Global styles have no boundary and are removed only by hoping nothing depends on them.
- **NEVER** use `!important` to win a specificity contest. Fix the selector, or the ordering, or use the project's escape hatch for overrides. An `!important` forces the next person to use two.
- Keep selector specificity low and flat. Deep descendant selectors couple styles to a DOM structure that will change.
- Reset and base styles belong in one place. **NEVER** add a second global reset.
- Style state with a data attribute or a state class, not by matching structural position (`:nth-child`) that reorders.

## Tailwind CSS

**MUST** check the installed major version before applying any of this. **Tailwind v4 changed configuration, directives, and several utility names.** Applying v3 patterns to a v4 project produces styles that silently do nothing.

Verified against Tailwind CSS v4 (latest 4.3.3) on 2026-08-11.

| Concern | v3 | v4 |
|---|---|---|
| Entry point | `@tailwind base; @tailwind components; @tailwind utilities;` | `@import "tailwindcss";` |
| Configuration | `tailwind.config.js` | CSS-first via `@theme`; a JS config must be loaded explicitly with `@config` |
| PostCSS plugin | `tailwindcss` | `@tailwindcss/postcss` |
| Vite plugin | — | `@tailwindcss/vite` |
| CLI | `tailwindcss` | `@tailwindcss/cli` |
| Custom utility | `@layer utilities { .tab-4 { … } }` | `@utility tab-4 { … }` |
| Important modifier | `!flex` (prefix) | `flex!` (suffix) |

In v4, theme values are declared in CSS as theme variables:

```css
@import "tailwindcss";

@theme {
  --color-brand-500: oklch(0.62 0.19 260);
  --font-display: "Satoshi", sans-serif;
  --breakpoint-3xl: 120rem;
}
```

Utilities renamed in v4 — a v3 class name here still parses as an unknown class and produces nothing:

```
shadow-sm → shadow-xs      shadow  → shadow-sm
rounded-sm → rounded-xs    rounded → rounded-sm
blur-sm → blur-xs          blur    → blur-sm
outline-none → outline-hidden       ring → ring-3
```

Removed in v4: the `*-opacity-*` utilities. Use an opacity modifier on the color instead (`bg-black/50`). Also removed: `flex-shrink-*` and `flex-grow-*` (use `shrink-*` and `grow-*`), and `overflow-ellipsis` (use `text-ellipsis`).

Working with Tailwind in any version:

- **MUST** use scale values (`p-4`, `text-sm`, `gap-2`) rather than arbitrary values (`p-[13px]`). An arbitrary value is a token that escaped the system. Use one only for a genuine one-off, and prefer adding a theme variable when it recurs.
- Extract a component or a named utility when the same long class string repeats. **NEVER** paste a 30-class string into five files.
- Order classes consistently — use the project's class-sorting tool if it has one.
- **NEVER** construct class names by string concatenation from a variable. The scanner cannot see them and the classes will not be generated. Map to complete class strings instead.
- Use the built-in state and responsive modifiers rather than hand-written media queries or extra classes.
- Reach for a plain stylesheet for what utilities genuinely cannot express — complex keyframes, deeply structural selectors, print styles.

## Anti-patterns

| Anti-pattern | Correct approach |
|---|---|
| A second styling system alongside the existing one | Use what the project uses |
| Hardcoded color or spacing where a token exists | Use the token |
| A new breakpoint for one component | Use the project's breakpoints |
| `!important` to win specificity | Fix the selector or ordering |
| Fixed height on growable content | Minimum height, let content size it |
| Deep descendant selectors | Flat, scoped, low-specificity selectors |
| Dark mode as a color inversion | Redefine tokens deliberately |
| Colors defined only inside a media or theme block | Define the default unconditionally |
| A second global reset | One reset, one place |
| Tailwind v3 utility names in a v4 project | Check the version; use v4 names |
| `@tailwind` directives in a v4 project | `@import "tailwindcss"` |
| Arbitrary Tailwind values as a habit | Scale values, or add a theme variable |
| Class names built by string concatenation | Complete class strings |
| A repeated 30-class string across files | Extract a component or utility |
| Page body scrolling horizontally | Contain wide content in its own scroller |

## Related skills

- `frontend-engineering` — accessibility, contrast, component boundaries, UI states.
- `performance` — asset and render cost.
- `frameworks/react`, `frameworks/nextjs`, `frameworks/flutter` — framework styling integration.
- `naming-conventions` — class, token, and file naming.
