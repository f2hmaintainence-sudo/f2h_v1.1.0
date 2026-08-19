# Skills

The engineering rulebook for this workspace. Each skill is a self-contained `SKILL.md` with
YAML frontmatter (`name`, `description`, `metadata.category`, `metadata.version`) and a body of
rules graded **MUST / NEVER / SHOULD / CONSIDER**.

These are loaded as agent skills through two entry points, both pointing at this directory:

| Consumer | Wiring |
|---|---|
| Any agent following the `.agents` convention | `.agents/skills` → symlink to `docs/skills`, plus `.agents/skills.json` |
| Claude Code | `.claude/skills/<name>` → one symlink per skill (flat, framework skills unnested) |

Editing a file here updates every consumer. Never edit a copy under `.claude/` — they are symlinks.

## Where to start

- **[agentic-development](agentic-development/SKILL.md)** — the working loop: which phase you are in,
  what to do with ambiguity, what counts as done, how to report honestly.
- **[skill-map](agentic-development/references/skill-map.md)** — which skill owns which decision,
  the order of consultation, and how to resolve a conflict between two of them. Read this before
  adding a rule anywhere.

## Catalogue

### Foundation — how code is written

| Skill | Owns |
|---|---|
| [agentic-development](agentic-development/SKILL.md) | The working loop, scope, ambiguity, honest reporting |
| [clean-code](clean-code/SKILL.md) | Function craft, abstraction timing, side effects, type safety, comments |
| [naming-conventions](naming-conventions/SKILL.md) | Casing, file names, ecosystem naming rules |
| [project-structure](project-structure/SKILL.md) | File and directory placement, nesting depth |
| [architecture](architecture/SKILL.md) | Layering, dependency direction, module boundaries |
| [data-structures](data-structures/SKILL.md) | Choosing the container or index for a workload |

### Domain — what the code does

| Skill | Owns |
|---|---|
| [api-design](api-design/SKILL.md) | Route naming, request/response contracts, errors, versioning |
| [database](database/SKILL.md) | Schema, migrations, indexes, parameter binding, transactions |
| [backend-engineering](backend-engineering/SKILL.md) | Service layering, transaction placement, caching, jobs |
| [frontend-engineering](frontend-engineering/SKILL.md) | Component boundaries, UI state, accessibility, UI states |
| [styling-css-tailwind](styling-css-tailwind/SKILL.md) | Styles, layout, tokens, theming, dark mode |
| [security](security/SKILL.md) | Vulnerability classes, secrets, authorization enforcement |
| [performance](performance/SKILL.md) | Measurement, complexity, round trips, caching decisions |
| [ai-llm-integration](ai-llm-integration/SKILL.md) | Prompts, structured output, tool calling, token budget |
| [dependency-management](dependency-management/SKILL.md) | Adding, updating, removing packages |
| [devops-docker-cicd](devops-docker-cicd/SKILL.md) | Images, compose, PM2, pipelines, deployment |

### Verification — proving and shipping it

| Skill | Owns |
|---|---|
| [testing](testing/SKILL.md) | Test strategy, isolation, what to assert |
| [debugging](debugging/SKILL.md) | Root-cause procedure for an unexplained failure |
| [code-review](code-review/SKILL.md) | Reviewing a completed diff |
| [git-workflow](git-workflow/SKILL.md) | Branches, commits, history safety, the pre-push gate |
| [documentation](documentation/SKILL.md) | What to write down, and where |

### Frameworks — load by detection, never by habit

Detect from the manifest and lockfile. Combinations are normal: this workspace loads
`nestjs` for the API, `nextjs` + `react` for the web app, and `flutter` for both mobile apps.

| Skill | Load when | Present here |
|---|---|---|
| [nestjs](frameworks/nestjs/SKILL.md) | `package.json` contains `@nestjs/core` | `apps/api` |
| [nextjs](frameworks/nextjs/SKILL.md) | `package.json` contains `next` | `apps/web` |
| [react](frameworks/react/SKILL.md) | `package.json` contains `react` | `apps/web` |
| [flutter](frameworks/flutter/SKILL.md) | `pubspec.yaml` lists `flutter` | `apps/mobile/*` |
| [laravel](frameworks/laravel/SKILL.md) | `composer.json` contains `laravel/framework` | — |
| [django](frameworks/django/SKILL.md) | `django` in the Python requirements | — |
| [fastapi](frameworks/fastapi/SKILL.md) | `fastapi` in the Python requirements | — |
| [golang](frameworks/golang/SKILL.md) | `go.mod` is present | — |

The four unused framework skills stay in this library deliberately — they carry no cost until
loaded, and they are the reference if a service in another stack is ever added.

## Workspace conventions

Three rules are specific to this workspace rather than to engineering in general. Each has one
owning skill; the others reference it rather than restating it.

| Rule | Owner |
|---|---|
| Route paths are lowercase `kebab-case`; legacy PascalCase kept as a secondary array alias | [api-design](api-design/SKILL.md) |
| `users` is the single source of truth for identity; satellite tables `JOIN` it; `$1` placeholders only | [database](database/SKILL.md) |
| Build both workspaces and check PM2 health before pushing to `main` | [git-workflow](git-workflow/SKILL.md) |

The human-facing summary of the same three rules lives in [`.agents/AGENTS.md`](../../.agents/AGENTS.md).
When a rule changes, update the owning skill and `AGENTS.md` together.

## Adding or changing a skill

1. Check the [skill-map](agentic-development/references/skill-map.md) ownership table first. If the
   topic already has an owner, the rule goes there — a rule stated in two skills will drift.
2. Keep generic skills framework-neutral. A rule that only holds under one framework belongs in
   that `frameworks/*` skill. A generic skill may say *that* something must happen; the framework
   skill says *how*.
3. Write the `description` for retrieval: what the skill covers, and the phrases that should
   trigger it. It is the only part read when deciding whether to load the skill.
4. Bump `metadata.version` — minor for added rules, major for a rule that reverses.
5. A new skill needs a symlink in `.claude/skills/` to become loadable; run `./scripts/sync-skills.sh`.
