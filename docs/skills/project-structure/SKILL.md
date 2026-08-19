---
name: project-structure
description: Use before creating any new file, directory, or module, and when deciding where existing code should be moved. Covers recognizing structure the framework imposes rather than leaves to you, inferring a repository's organizational pattern from its existing files, choosing between layer-based and feature-based placement, limiting nesting depth, and avoiding dumping-ground directories such as utils, helpers, common, misc, shared, and temp. Triggers on "where should this file go", "create a new component/module/service", adding a directory, splitting a large file, or organizing a new feature. Also use when a change would introduce a top-level directory or a second home for something that already has one. Not for layering and dependency rules (architecture) or for what a file is called (naming-conventions).
metadata:
  category: foundation
  version: "1.1.0"
---

# Project Structure

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## Before creating any file

**MUST** work through this, in order:

1. **Look for an existing home.** Search for the concept by name, by exported symbol, and by synonym. Most "new" files belong in a file that already exists.
2. **Read the neighbors.** Open two or three files that do a similar job. They define the naming, size, and export conventions you must match.
3. **Identify the organizing pattern** (see below). Do not mix patterns within one area.
4. **Determine ownership.** Which feature or module is responsible for this code? It goes there. If two features want it, it belongs to neither — see [Shared code](#shared-code).
5. **Only then create the file**, named the way its neighbors are named.

**NEVER** create a new top-level directory without a stated reason. Top-level structure is a project-wide decision, not a side effect of one change.

## This workspace

`f2h-monorepo` is an npm-workspaces monorepo. Four deployable apps, one lockfile, one `node_modules`
at the root:

```
apps/api/              NestJS 11 — src/panels/{admin,customer,delivery-partner}/, src/shared/
apps/web/              Next.js 16 App Router — src/app/{(landing),(auth),(panel)}/
apps/mobile/customer/  Flutter — lib/{app,core,features,theme}/
apps/mobile/delivery/  Flutter
docs/skills/           this rulebook
scripts/               workspace tooling
ecosystem.config.js    PM2 process definitions (api-f2hfresh, frontend-f2hfresh)
```

- A new API feature goes under the **panel that owns its audience**, not at `src/` root. Code two
  panels need goes in `apps/api/src/shared/`.
- A new web route goes inside the matching App Router **route group** — the parentheses are grouping
  only and do not appear in the URL.
- **NEVER** import across app boundaries by relative path (`../../api/src/...`). Apps communicate
  over HTTP; shared types are duplicated deliberately or published as a workspace package.
- Dependencies install at the root. Add a package to the workspace that uses it
  (`npm install -w apps/api <pkg>`), never to the root manifest. See `dependency-management`.

## Framework-imposed structure comes first

Some structure is **not a choice**. Before applying any pattern below, determine whether the framework dictates the location or the file name:

- Routing conventions where directories or file names map to URLs.
- Reserved file names the framework resolves by name.
- Autoloading rules that tie a class name to its file path.
- Generator output locations, which define where the framework expects things.

**MUST** follow framework-imposed structure exactly. It is behavior, not style. Where a `frameworks/*` skill exists for the detected framework, load it before creating files.

Everything the framework does not dictate falls to the patterns below.

## Identifying the organizing pattern

Read the existing directory names and match:

| Pattern | Looks like | Place new code by |
|---|---|---|
| **Layer-based** | `controllers/`, `services/`, `models/`, `views/` | Technical role |
| **Feature-based** | `billing/`, `auth/`, `search/`, each with its own internals | Feature that owns it |
| **Hybrid** | Feature directories, layers inside them | Feature first, then role |
| **Flat** | Few directories, files at one level | Keep it flat until it hurts |

**MUST** follow whichever pattern the surrounding area already uses. A feature-based repo with one new `services/` directory is worse than either pattern applied consistently.

If the repo is genuinely new: prefer **feature-based** once there is more than one feature, because it keeps related change together and makes deletion possible. Prefer **flat** while the project is small — premature directory structure is as costly as premature abstraction.

## What to match from the neighbours

File and identifier casing is owned by the `naming-conventions` skill, which resolves it by ecosystem. Structural decisions belong here:

- **Suffix convention** — whether the project writes `user_service.py` or `service.py` inside `user/`, `orders.service.ts` or `service.ts`. Do not introduce a second style.
- **Test location** — `__tests__/`, `tests/`, `test/`, alongside the source, or mirroring the source tree. Put tests where the project puts tests.
- **Index/barrel files** — if the project uses them, add to them; if it does not, do not introduce them. They can defeat tree-shaking and create import cycles.
- **Depth** — how many levels deep comparable code sits. Match it.

## Nesting depth

Directory depth should reflect real structure, not aspiration. Each level a reader must traverse costs navigation and makes imports longer and more fragile.

```
Avoid    src/core/common/shared/utils/helpers/format.ts
Prefer   src/formatting/currency.ts
```

- **SHOULD NOT** create a directory that will hold one file, unless the project's pattern is one directory per unit and you are following it.
- **SHOULD NOT** create a directory whose name repeats its parent's meaning (`shared/common/`, `core/base/`).
- A chain of single-child directories is a sign the structure was designed before the content existed. Flatten it.
- Depth is justified when each level is a real, named boundary someone would look for — a feature, a layer, a bounded domain.

## Shared code

Directories named `utils/`, `helpers/`, `common/`, `shared/`, `lib/`, `misc/`, `core/`, `stuff/`, or `temp/` become dumping grounds because their names admit anything. Their contents drift out of anyone's ownership and get duplicated because nobody can find them.

**Rules:**

- **NEVER** create a new `utils`, `helpers`, `misc`, `common`, `stuff`, or `temp` directory.
- If one already exists, adding to it is acceptable — but first check whether the code belongs to a specific feature instead.
- When shared code has a real subject, give it a module named for the subject: `money/`, `dates/`, `validation/`, `http-client/`. A named module can be reasoned about, tested, and owned.
- One function used by one caller is not shared code. Leave it next to its caller until a second real caller appears.

**Decision rule for placement:**

```
Used by exactly one feature        → inside that feature
Used by several, has a clear subject → its own named module
Used by several, no clear subject    → leave the duplication; the abstraction is not ready
```

## File size and splitting

There is no universal line limit; the project's own files set the norm. Split when one of these is true, not because a number was crossed:

- The file holds several unrelated responsibilities.
- You must scroll past unrelated code to make a single coherent change.
- Its name no longer describes its contents.
- Different features change it for unrelated reasons.

When splitting, **MUST** split along responsibility lines and keep the pieces in the same area. Splitting a 600-line file into `foo-part1` and `foo-part2` moves the problem without solving it.

## Things that MUST NOT enter the repository

- Build output, compiled artifacts, and caches (unless the project deliberately commits them — check `.gitignore` first).
- Dependency directories such as `node_modules/`, `vendor/`, `.venv/`.
- Local environment files containing real values (`.env`). Commit a `.env.example` with placeholder values instead.
- Editor, OS, and machine-specific files.
- Scratch files, one-off scripts, backup copies (`file.old`, `file-copy`, `file.bak`), and debugging output.
- Large binaries or data dumps that the project does not already track.

If a temporary file is needed while working, place it outside the repository or delete it before finishing. See the `git-workflow` skill for the pre-completion check.

## Moving existing files

Moving files creates large, noisy diffs and breaks other people's in-flight work.

- **SHOULD NOT** relocate files unless the move is the requested task, or the current location actively blocks the change.
- When a move is necessary, do it as its own change, separate from behavioral edits, so the diff stays reviewable.
- Update every import, reference, config path, and build entry. Verify by running the build and tests, not by searching text alone.

## Related skills

- `architecture` — which layer owns the code, before you decide which file.
- `naming-conventions` — what the file and its contents are called.
- `frameworks/*` — structure the framework imposes rather than leaves to you.
- `clean-code` — how the code inside the file is written.
- `documentation` — recording a structural convention once it is established.
