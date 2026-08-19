---
name: dependency-management
description: Use before adding, upgrading, replacing, or removing any third-party package, and when choosing between an existing dependency and new code. Covers checking whether the project already solves the problem, evaluating a candidate package for maintenance and security, using the project's existing package manager and lockfile, version pinning, transitive and duplicate dependencies, runtime and bundle cost, and safe upgrades. Identifies the project's package manager from its lockfile - npm, pnpm, Yarn, Bun, uv, Poetry, pip, Composer, Cargo, Go modules, pub, or Bundler - and gives the reproducible install command for CI. Triggers on "install", "add a package", "which library should I use", "npm/pnpm/bun/pip/uv/cargo/go get", an import of something not currently in the manifest, a dependency vulnerability alert, or an upgrade request. Also use when tempted to add a small utility package for something the standard library or an existing dependency already handles.
metadata:
  category: domain
  version: "1.0.0"
---

# Dependency Management

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

Every dependency is permanent code you did not write, running with your process's privileges, that someone must keep updated. Adding one is an architectural decision.

## Before adding anything

**MUST** work through this in order. Stop at the first "yes".

1. **Does the language's standard library do this?** Date formatting, UUIDs, hashing, HTTP requests, JSON, path handling, and randomness are built in almost everywhere now.
2. **Does an existing dependency do this?** Read the manifest and the lockfile. Projects routinely carry a validation library, a date library, and an HTTP client already — check before adding a second.
3. **Does the project already do this itself?** Search the codebase for the capability by name and by concept.
4. **Is this small enough to write?** A few dozen lines you own, test, and understand beat a package with a transitive tree, a maintenance risk, and an upgrade obligation.

**NEVER** add a dependency for something trivial, and never add a second library that overlaps a first. Two date libraries, two HTTP clients, or two state managers in one project is a defect.

## Evaluating a candidate

When a dependency is genuinely warranted, check:

| Check | Reject or escalate if |
|---|---|
| **Maintenance** | No release or commit activity for a long period relative to its ecosystem; unresolved critical issues; explicitly deprecated or archived |
| **Adoption** | Very low usage relative to alternatives — few eyes on the code, and little chance of a fix if it breaks |
| **Security** | Known unpatched advisories; check with the project's audit tooling |
| **License** | Incompatible with the project's licensing — check what the project already uses |
| **Compatibility** | Requires a runtime, language, or framework version the project does not have; conflicts with an existing pinned version |
| **Cost** | Large transitive tree; significant bundle size on a client path; native build steps that complicate CI or deployment |
| **Name** | Not the exact expected name. Typosquatting is a live supply-chain attack — verify the package identity against its official documentation or repository |

Prefer the option with the smallest transitive tree that solves the actual problem. A focused library beats a framework you use 5% of.

**MUST** state, when proposing a dependency: what it does, why existing code and dependencies cannot, and what it costs.

## Adding it

- **MUST use the project's existing package manager.** The lockfile identifies it — see the table below. Mixing package managers corrupts the dependency graph and produces builds that differ between machines.
- **MUST** install through the package manager so the manifest and lockfile update together. Never hand-edit the manifest and never hand-edit the lockfile.
- **MUST** commit the lockfile if the project tracks one. That is what makes builds reproducible.
- Put development-only tools in the dev/test dependency group, not the runtime one.
- Follow the project's existing version-range convention. Applications SHOULD pin or lock exactly; libraries SHOULD accept compatible ranges so consumers can deduplicate.

### Identifying the package manager

**MUST** read the lockfile, not the manifest. Several managers share a manifest format and differ only by lockfile, and the presence of two lockfiles means someone already made this mistake — resolve it rather than adding a third.

| Lockfile | Manager | Add | Reproducible install (use in CI) |
|---|---|---|---|
| `package-lock.json` | npm | `npm install <pkg>` | `npm ci` |
| `pnpm-lock.yaml` | pnpm | `pnpm add <pkg>` | `pnpm install --frozen-lockfile` |
| `yarn.lock` | Yarn | `yarn add <pkg>` | `yarn install --immutable` |
| `bun.lock`, `bun.lockb` | Bun | `bun add <pkg>` | `bun install --frozen-lockfile` |
| `uv.lock` | uv | `uv add <pkg>` | `uv sync --frozen` |
| `poetry.lock` | Poetry | `poetry add <pkg>` | `poetry install --no-root` |
| `Pipfile.lock` | Pipenv | `pipenv install <pkg>` | `pipenv sync` |
| `requirements.txt` with pinned versions | pip | edit and re-compile | `pip install -r requirements.txt` |
| `composer.lock` | Composer | `composer require <pkg>` | `composer install` |
| `Cargo.lock` | Cargo | `cargo add <pkg>` | `cargo build --locked` |
| `go.sum` | Go modules | `go get <pkg>` | `go mod download` then build |
| `pubspec.lock` | pub | `dart pub add <pkg>` | `dart pub get --enforce-lockfile` |
| `Gemfile.lock` | Bundler | `bundle add <pkg>` | `bundle install --deployment` |

**MUST** use the reproducible-install form in CI and in container builds. A plain install may resolve versions the lockfile does not specify, which means the build is not the build you tested. See the `devops-docker-cicd` skill.

Notes worth knowing:

- **pnpm** links from a content-addressable store rather than copying, so `node_modules` is not a plain tree. Packages that assume a flat, hoisted layout may need explicit hoisting configuration — that is a configuration issue, not a reason to switch managers.
- **Bun** is both a runtime and a package manager. A project can use Bun to install while running on Node, or vice versa. Check which before assuming a Bun-specific API is available.
- **uv** manages the Python interpreter as well as dependencies, and `uv add` updates `pyproject.toml` and `uv.lock` together. Do not mix `pip install` into a uv-managed project — it installs outside the lockfile.
- **Cargo** and **Go modules** resolve versions differently from the rest of this table: Cargo unifies compatible semver ranges, and Go selects the minimum version satisfying all requirements. Neither needs a separate install step before building.
- **Go** has no separate dev-dependency group; test-only dependencies live in the same module graph.

## Approval

**MUST ask before**: replacing a framework, ORM, test runner, build tool, or state management library; adding a dependency with a restrictive or copyleft license into a project that avoids them; adding anything that changes how the project is built, deployed, or run.

**Decide yourself** for: a well-established, narrowly-scoped library in the project's own ecosystem, matching everything above — and state it in your report.

## Upgrades

- Upgrade for a reason: a security advisory, a needed fix, a required feature, or a scheduled maintenance pass. Not because a newer version exists.
- **NEVER** bundle a dependency upgrade into a feature change. When it breaks something, nobody can tell which change caused it.
- Read the changelog and migration notes for major versions before upgrading, not after the build fails.
- Upgrade **one package or one coherent group at a time**, running the full test suite between steps.
- If an upgrade forces code changes, make them against the new API rather than adding a compatibility shim. **NEVER** pin back to an old version to avoid the work without saying so — that silently defers a security or maintenance obligation.

## Security advisories

- Run the project's audit tooling when adding or upgrading: `npm audit`, `pnpm audit`, `yarn npm audit`, `bun audit`, `pip-audit` or `uv pip audit`, `composer audit`, `cargo audit`, `govulncheck`, `bundle audit`, or whichever scanner the project configures.
- Assess whether the vulnerable path is actually reachable from your code before treating an advisory as urgent — but never dismiss one without checking.
- Prefer upgrading the vulnerable package. If it is transitive and no direct upgrade exists, use the ecosystem's override or resolution mechanism, and record why.
- **NEVER** silence an advisory by adding it to an ignore list without a stated reason and a follow-up path.

## Removing dependencies

- When a dependency's last usage disappears, remove it from the manifest in the same change.
- Verify nothing else imports it — search the whole repository, including config files, scripts, and CI, before removing.
- Removing an unused dependency you happened to notice is **out of scope** for a feature change. Report it instead.

## Related skills

- `security` — supply-chain risk and vulnerable dependencies.
- `devops-docker-cicd` — frozen installs and dependency caching in CI and images.
- `architecture` — whether a dependency belongs at this layer at all.
- `data-structures` — the standard library usually already provides it.
- `performance` — bundle and runtime cost of an added package.
- `documentation` — recording why a significant dependency was chosen.
