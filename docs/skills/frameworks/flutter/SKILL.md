---
name: flutter
description: Use when working in a Flutter or Dart application - building widgets, screens, state management, navigation, repositories, or platform integration. Covers Dart file and identifier naming, stateless versus stateful widget choice, composition over deep widget nesting, const constructors and rebuild cost, list and builder performance, where state and business logic belong relative to widgets, async handling and disposal, error and loading states, null safety, and widget and unit testing. Triggers on pubspec.yaml containing flutter, any .dart file, or mentions of widgets, BuildContext, setState, providers, or pub packages. Load with naming-conventions for Dart naming, which differs from JavaScript and PHP conventions.
compatibility: For Flutter and Dart projects. Verify version-specific APIs against the project's pubspec.lock and the Flutter documentation for that version.
metadata:
  category: framework
  version: "1.1.0"
---

# Flutter

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## Version context

Verified against Flutter 3.44.x and Dart 3.12.x (stable as of 2026-08-11).

**MUST** read the project's `pubspec.yaml` and `pubspec.lock` for the Flutter and Dart SDK constraints and the state management package in use before writing code. When an API looks version-sensitive, check the documentation for the pinned version rather than assuming.

## Detect before writing

- `pubspec.yaml` — SDK constraints, state management package (Provider, Riverpod, Bloc, GetX, or none), routing package, HTTP client, code generation.
- `analysis_options.yaml` — the lint set in force. **This is the project's style contract; satisfy it rather than arguing with it.**
- `lib/` — whether the project organizes by feature or by layer, and how screens, widgets, and data access are separated.
- Two or three existing widgets and one existing repository or service near your change.
- `test/` — the existing widget and unit test style.

## Naming

Dart's conventions differ from JavaScript's and PHP's, and applying the wrong one is a common cross-ecosystem error:

```
Files, directories, packages     lowercase_with_underscores
Classes, enums, typedefs, extensions   UpperCamelCase
Members, variables, parameters   lowerCamelCase
Constants and enum values        lowerCamelCase, not SCREAMING_CAPS
Private identifiers              leading underscore
Test files                       <source>_test.dart
```

`order_repository.dart` contains `OrderRepository`. That mismatch between file case and class case is **correct** and MUST NOT be "fixed". Full detail is in the `naming-conventions` skill and its ecosystem reference.

## This workspace (apps/mobile)

Two Flutter apps — `customer` and `delivery` — that ship as **web PWAs**, not store builds:

```
lib/
  main.dart  app.dart  firebase_options.dart
  core/      api  auth  cache  config  di  errors  guards  network  payments
             services  session  utils  widgets          cross-feature infrastructure
  features/<feature>/presentation/{screens,bloc}/        address catalog orders
                                                        profile subscription wallet …
  theme/
```

- State is **`flutter_bloc`** (blocs and cubits). Do not introduce Provider, Riverpod, or GetX
  alongside it — one state mechanism per app. See `clean-code` on relocating complexity.
- A feature MUST NOT import from another feature's `presentation/`. Shared behavior moves to
  `core/`; session and auth state is read from the session cubit in `core/session/`, not re-derived.
- HTTP goes through the `core/network` and `core/api` layer, which owns base URL, auth headers, and
  error mapping. **NEVER** construct a bare `http`/`dio` client inside a screen or bloc.
- Build and deploy are separate from the git push:

```
npm run build:customer-web     # flutter build web --release --pwa-strategy=none
npm run deploy:customer-web    # builds, then copies to customer.f2hfresh.com
npm run deploy:partner-web     # partner.f2hfresh.com
```

  A mobile change is **not** deployed by pushing to `main`. Say so explicitly when reporting the
  work — see `git-workflow`.

## Widget structure

- **Compose, do not nest deeply.** A `build` method hundreds of lines deep with heavily indented widget trees is the characteristic Flutter maintainability failure. Extract meaningful sub-trees into named widgets.
- **Extract into a widget class, not a method returning a widget.** A `Widget _buildHeader()` helper looks tidier but is rebuilt with its parent and cannot have its own `const` constructor or its own element in the tree. A separate widget class can skip rebuilds; a helper method cannot.
- Name extracted widgets for what they represent (`OrderSummaryCard`), not where they sit (`_buildSection2`).
- **Prefer `StatelessWidget`.** Use `StatefulWidget` only for state genuinely local to the widget — animation controllers, text controllers, focus, scroll position, expansion toggles.
- **MUST** add `const` constructors wherever possible, and construct widgets with `const` where the arguments are compile-time constants. This is the cheapest real rebuild optimization Flutter offers, and the analyzer will point out the opportunities.

## State and business logic

- **NEVER** put business rules, HTTP calls, or database access in a widget's `build` method. `build` can be called many times per second; it MUST be pure and cheap.
- Business logic belongs in a service, repository, notifier, bloc, or controller — whatever layer the project already uses. Widgets render state and dispatch intent.
- **MUST** use the state management approach the project already has. **NEVER** introduce a second one; mixed state management is among the hardest Flutter problems to unpick.
- Keep state as local as the requirement allows. Lifting everything to a global store makes every screen depend on everything.
- Rebuild the **smallest possible subtree**. Place the consumer or builder at the widget that actually depends on the value, not at the top of the screen.
- `setState` in a large `StatefulWidget` rebuilds the entire subtree. Push the stateful part down into a small widget instead.

## Lifecycle and disposal

- **MUST** dispose everything you create in `initState` or as a field: animation controllers, text controllers, focus nodes, scroll controllers, stream subscriptions, timers, platform channel listeners. Undisposed resources are a leak and a common source of "setState called after dispose" crashes.
- **NEVER** call `setState` after `await` without checking the widget is still mounted. The user can navigate away mid-request.
- **NEVER** use `BuildContext` across an async gap without confirming it is still valid. The analyzer's lint for this exists because it causes real crashes.
- Do not perform async work directly in `initState`; call a method that handles its own errors and mounted checks.

## Rendering performance

- **Use the builder forms for long or unbounded lists** (`ListView.builder`, `GridView.builder`, `SliverList`) so only visible items are built. A `ListView` with hundreds of children built eagerly is the usual cause of a janky list.
- Give list items stable keys when the list reorders, filters, or has items inserted or removed, so element state is not reused for the wrong item.
- **NEVER** do expensive work in `build`: parsing, sorting, filtering large collections, formatting many values, creating heavy objects. Compute it once and hold the result.
- Set `cacheExtent`, `itemExtent`, or fixed extents where item sizes are known — it removes layout work.
- Size and cache images explicitly (`cacheWidth`/`cacheHeight`); decoding a full-resolution image for a thumbnail is a common memory problem.
- Avoid unnecessary `Opacity`, `ClipRRect`, and shader-heavy effects on scrolling content; prefer cheaper alternatives where they exist.
- **MUST** profile in **profile or release mode**, never debug. Debug builds are dramatically slower and will mislead you. See the `performance` skill.

## Async and errors

- **MUST** handle all states of an async view: loading, error, empty, and data. A `FutureBuilder` or `StreamBuilder` that only handles `hasData` shows a blank screen on error.
- Prefer sealed classes or a union type for view state over a bag of independent `isLoading`, `error`, and `data` fields that can hold contradictory combinations.
- **NEVER** show a raw exception, stack trace, or platform error message to the user. Show what happened and the next action.
- Catch narrowly and handle deliberately. **NEVER** use a bare `catch` that discards the error.
- Prefer a single future created once (in `initState` or a notifier) over creating it inside `build` — `build` runs repeatedly and would restart the request each time.

## Null safety and typing

- **MUST NOT** use the null assertion operator (`!`) to silence an analyzer complaint you have not reasoned about. It converts a compile-time warning into a runtime crash. Use a null check, a local variable after checking, `?.`, or `??`.
- **NEVER** use `dynamic` to bypass a type error. Model the type.
- Prefer `final` for fields and locals that do not change, and `const` for compile-time constants.
- Parse external JSON into typed models with explicit conversion, rather than passing maps around. Whatever code generation the project uses, follow it.

## Layout

- Follow the project's existing theming: use `Theme.of(context)` and the defined text and color schemes rather than hardcoded colors and sizes.
- Handle constrained and unbounded layouts deliberately. Unbounded-height errors inside a `Column` are a layout mistake, not something to work around with a fixed height.
- Respect safe areas, text scaling, and both orientations. Never assume a fixed screen size.
- Test with a large system font scale — hardcoded heights break there.

## Testing

- **Unit test** business logic, repositories, and notifiers with no widget involved. These are fast and where most logic should be testable.
- **Widget test** rendering, interaction, and state changes. Pump the widget, interact, and assert on what the user would see.
- Prefer finding widgets by user-visible text or semantics over internal type or key where practical, so tests survive refactoring. See the `testing` skill.
- **MUST** substitute network, storage, and platform channels in tests rather than reaching real services.
- Golden tests are useful for stable visual components; they are brittle for anything that changes often.
- Match the project's existing test structure and helper setup.

## Validation gates

```
dart format --output=none --set-exit-if-changed .
flutter analyze
flutter test
```

`flutter analyze` uses the project's `analysis_options.yaml`. **MUST** run it and fix what it reports. **NEVER** add an `// ignore:` comment without understanding the rule and stating why.

## Anti-patterns

| Anti-pattern | Correct approach |
|---|---|
| Applying kebab-case or PascalCase to Dart file names | `lowercase_with_underscores.dart` |
| `SCREAMING_CAPS` constants | `lowerCamelCase` per Effective Dart |
| `Widget _buildX()` helper methods | Extract a widget class |
| Deeply nested `build` method | Compose named widgets |
| Missing `const` constructors | Add them; the analyzer flags them |
| Business logic or HTTP call in `build` | A service, repository, or notifier |
| `ListView` with many eager children | `ListView.builder` |
| Future created inside `build` | Create it once, outside `build` |
| `FutureBuilder` handling only `hasData` | Handle loading, error, and empty |
| `setState` after `await` with no mounted check | Check `mounted` first |
| `BuildContext` used across an async gap | Re-validate or capture what you need first |
| Controllers and subscriptions never disposed | Dispose in `dispose()` |
| `!` to silence the analyzer | Check for null properly |
| A second state management library | Use the project's existing one |
| Profiling in debug mode | Profile or release mode |
| Hardcoded colors and text sizes | The project's theme |

## Related skills

- `naming-conventions` — Dart naming, which differs from other ecosystems here.
- `performance` — measuring before optimizing.
- `frontend-engineering` — UI states, accessibility, forms as general concerns.
- `testing` — what to test and at which level.
- `architecture` — separating widgets from domain logic.
