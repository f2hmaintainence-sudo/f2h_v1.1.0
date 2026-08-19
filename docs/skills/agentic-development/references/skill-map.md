# Skill map

Which skill owns which decision, and what to do when two disagree.

## Convention layers

Every naming, structure, and pattern decision resolves through these layers, narrowest last. A later layer overrides an earlier one.

```
general engineering principles     the generic skills
        ↓
language conventions               PSR/PER, Effective Dart, TypeScript norms
        ↓
framework conventions              the frameworks/* skills
        ↓
project conventions                what this repository already does
```

**MUST** apply the narrowest layer that answers the question. A generic principle never overrides a framework requirement, and a framework default never overrides a coherent project convention.

## Order of consultation

Applied roughly in this order during a change. Later skills do not override earlier ones; they answer narrower questions.

```
agentic-development     which phase am I in, and may I proceed?
        ↓
architecture            which layer owns this, and which way may it depend?
        ↓
project-structure       which directory and file does it go in?
        ↓
naming-conventions      what is it called, in this ecosystem?
        ↓
clean-code              how is the code itself written?
        ↓
frameworks/*            what does this framework require or forbid?
        ↓
domain skills           api-design · database · frontend-engineering ·
                        backend-engineering · security · performance ·
                        data-structures · dependency-management ·
                        styling-css-tailwind · ai-llm-integration ·
                        devops-docker-cicd
        ↓
testing                 what proves it works?
        ↓
code-review             what is wrong with the diff?
        ↓
git-workflow            how does it safely leave the working tree?
        ↓
documentation           what did this change invalidate?
```

## Generic and framework skills are separate

Generic skills MUST stay framework-neutral. A framework-specific rule belongs in the matching `frameworks/*` skill, never in a generic one.

```
clean-code            "extract a function when it does two things"        generic
frameworks/laravel    "use a Form Request and $request->validated()"      framework
```

A generic skill may say *that* something must happen (validate at the boundary). The framework skill says *how* it happens in that framework. Neither restates the other.

The one deliberate exception is the project-conventions layer: a workspace rule may be restated in a skill it constrains, **provided the restatement names its owner**. See *Workspace-specific rules* below.

## Ownership boundaries

Deliberately non-overlapping. When a topic appears in two skills, the owner sets the rule and the other refers to it.

| Topic | Owner | Others defer on |
|---|---|---|
| The working loop, ambiguity, scope, honest reporting | `agentic-development` | Whether to proceed, ask, or stop |
| Verifying version-sensitive claims | `agentic-development` | Whether a recommendation is current |
| Layering, dependency direction, boundaries | `architecture` | Where a new module may point |
| File and directory placement, nesting depth | `project-structure` | Whether to create a directory |
| Casing, file names, ecosystem naming rules | `naming-conventions` | What anything is called |
| Function, module, and abstraction craft | `clean-code` | Local error-handling style, abstraction timing |
| Measurement, complexity, round trips, caching decisions | `performance` | Whether an optimization is justified |
| Choosing a container or index for a workload | `data-structures` | Lookup, iteration, and memory cost |
| Vulnerability classes, secrets, authz enforcement | `security` | Any rule that would weaken a control |
| Wire-level contract, error payload shape, versioning | `api-design` | What an endpoint returns |
| Schema, migrations, indexes, transaction semantics | `database` | Data integrity and query cost |
| Where transaction boundaries sit in service code | `backend-engineering` | Which operations are atomic |
| Cache placement in service code | `backend-engineering` | Where a cache read lives |
| Component boundaries, UI state, accessibility, UI states | `frontend-engineering` | Presentation-layer structure |
| Styles, layout, tokens, theming, dark mode | `styling-css-tailwind` | Any visual or CSS decision |
| Prompts, structured output, tool calling, retrieval, token budget | `ai-llm-integration` | Anything calling a language model |
| Images, compose, pipelines, deployment, pipeline security | `devops-docker-cicd` | Build, CI, and deploy configuration |
| Test strategy, isolation, what to assert | `testing` | Whether a test is worth writing |
| Root-cause procedure | `debugging` | How to approach an unexplained failure |
| Adding, updating, removing packages | `dependency-management` | Whether a dependency is justified |
| What to write down and where | `documentation` | Whether a decision needs recording |
| Branches, diffs, commits, history safety | `git-workflow` | Any repository-mutating command |
| Reviewing a completed diff | `code-review` | Whether the change is ready |
| Framework-imposed structure, APIs, and idioms | `frameworks/<name>` | Anything the framework dictates |

## Workspace-specific rules

Three rules are particular to this repository rather than to engineering in general. Each has one
owner; other skills reference it. If you find one restated somewhere without a pointer to its owner,
that copy is the one to fix.

| Rule | Owner | Restated for context in |
|---|---|---|
| Route paths are lowercase `kebab-case`; legacy PascalCase survives only as a secondary array alias | `api-design` | `clean-code`, `frameworks/nestjs`, `naming-conventions` |
| `users` owns identity; satellite tables `JOIN` it; PostgreSQL `$1` placeholders only | `database` | `clean-code`, `frameworks/nestjs`, `backend-engineering` |
| Build both workspaces and check PM2 before pushing to `main` | `git-workflow` | `frameworks/nestjs`, `devops-docker-cicd` |

The layered map still applies: these sit at the **project conventions** layer, so they override the
generic and framework layers above them.

## Framework skills

Load the one matching the detected ecosystem. Detect from the manifest and lockfile, never from habit.

| Skill | Load when |
|---|---|
| `frameworks/laravel` | `composer.json` contains `laravel/framework` |
| `frameworks/nestjs` | `package.json` contains `@nestjs/core` |
| `frameworks/nextjs` | `package.json` contains `next` |
| `frameworks/react` | `package.json` contains `react` |
| `frameworks/flutter` | `pubspec.yaml` lists `flutter` |
| `frameworks/fastapi` | `fastapi` in the Python requirements or `pyproject.toml` |
| `frameworks/django` | `django` in the Python requirements or `pyproject.toml` |
| `frameworks/golang` | `go.mod` is present |

Combinations are normal and expected: a Next.js project loads `nextjs` **and** `react`; a Laravel API loads `laravel`, `api-design`, and `database`; a Django project serving a REST API loads `django` and `api-design`. When two framework skills apply, the more specific one wins on any conflict — `nextjs` overrides `react` on server and client boundaries and on routing.

`frameworks/golang` covers a language rather than a framework. It sits here because Go's conventions — module layout, error wrapping, context propagation — are ecosystem-specific in the same way a framework's are.

For an ecosystem with no framework skill, apply the generic skills plus the language's own style authority, and detect conventions from the repository.

In this workspace the detection resolves to `nestjs` (`apps/api`), `nextjs` and `react` (`apps/web`),
and `flutter` (`apps/mobile/*`). Those four are the only framework skills linked into
`.claude/skills`; `laravel`, `django`, `fastapi`, and `golang` remain in `docs/skills` unlinked.
`scripts/sync-skills.sh` re-derives this from the manifests — do not hand-edit the links.

## Conflict resolution

When two skills, or a skill and the project, point in different directions, resolve in this order:

1. **The user's explicit instruction for this task.** A reaffirmed instruction settles the matter.
2. **Stated project requirements** — the ticket, spec, or acceptance criteria.
3. **Security and data integrity.** Never trade these for convenience, style, speed, or performance.
4. **Correctness.** A working, well-understood implementation beats an elegant broken one.
5. **Framework requirements.** Autoloading rules, reserved file names, and routing conventions are behavior, not preference.
6. **Existing project conventions.** Consistency outranks personal preference and outranks an ecosystem default. Deviate only when the convention causes a concrete technical problem — and say so.
7. **The simpler solution.** When everything above is satisfied and options remain, take the one with less machinery. Prefer the measured improvement over the speculative one.

If a genuine contradiction between two skills survives this ordering, follow the ordering, state the conflict in your report, and treat the skills as needing correction.
