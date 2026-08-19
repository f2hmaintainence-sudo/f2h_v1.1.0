---
name: devops-docker-cicd
description: Use when writing or changing container images, compose files, CI pipelines, or deployment configuration. Covers multi-stage Dockerfile builds, layer caching and image size, running as a non-root user, build-time versus run-time environment separation, secrets that must never enter an image or a log, compose service definitions and healthchecks, CI pipeline structure and caching, least-privilege pipeline tokens, pinning third-party actions to an immutable commit SHA, script-injection through untrusted pipeline input, and zero-downtime deployment with migrations and rollback. Triggers on Dockerfile, docker-compose.yml, .dockerignore, any file under .github/workflows, .gitlab-ci.yml, Jenkinsfile, Procfile, or Kubernetes manifests, and on "deploy", "build the image", "add a CI step", or "why is the pipeline failing".
compatibility: Container and CI tooling changes frequently. Verify syntax and security guidance against the documentation for the versions the project actually uses.
metadata:
  category: domain
  version: "1.1.0"
---

# DevOps, Docker and CI/CD

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## Detect before changing

**MUST** read before editing any pipeline or image definition:

- Every existing `Dockerfile`, `compose` file, and `.dockerignore`.
- The CI workflow files — **these are the authoritative definition of what "passing" means** for the project.
- How configuration and secrets reach the running application today.
- How deployment currently happens, and whether migrations run as part of it.

**NEVER** change how an application is built, deployed, or run without explicit approval. A pipeline change can break every future deploy, and the failure surfaces later, to someone else.

## Dockerfile

**Multi-stage builds are the default.** Build with the toolchain, ship without it:

```dockerfile
FROM <language-image> AS build
WORKDIR /app
COPY <manifest> <lockfile> ./
RUN <install dependencies>      # cached until the lockfile changes
COPY . .
RUN <build>

FROM <minimal-runtime-image> AS runtime
WORKDIR /app
COPY --from=build /app/<build-output> ./
USER <non-root>
CMD ["<entrypoint>"]
```

Rules:

- **MUST copy the manifest and lockfile first, install, then copy source.** Copying everything before installing invalidates the dependency layer on every source change, so nothing caches.
- **MUST use a `.dockerignore`.** Without it, the build context includes `.git`, `node_modules`, `vendor`, local `.env` files, and build output — slowing builds and risking secret inclusion.
- **MUST pin base images** to a specific version, not a floating tag. Prefer a digest where reproducibility matters. `latest` makes builds unrepeatable.
- **MUST run as a non-root user** in the runtime stage. Root in a container is a privilege-escalation path.
- Install only production dependencies in the runtime stage.
- Combine related `RUN` commands and clean package-manager caches in the same layer — a separate cleanup layer does not shrink the image.
- Prefer the smallest runtime base image the application actually works on. Verify it works; minimal images lack shells, certificates, and libc variants that some binaries need.
- Add a `HEALTHCHECK` where the orchestrator uses it.

**NEVER** in an image:

- A secret, key, token, or credential — in an `ENV`, an `ARG`, a `COPY`ed file, or a `RUN` command. **Every layer is retrievable from the final image**, so a secret removed in a later layer is still present. Use the builder's secret mount, or inject at run time.
- A local `.env` file, private key, or cloud credential file.
- `COPY . .` in a runtime stage without a `.dockerignore`.

## This workspace

Production runs under **PM2 on a single server**, not containers. `docker-compose.yml` exists for
local `api` / `web` / `redis`; changing it does not change what production runs.

```
ecosystem.config.js       api-f2hfresh (apps/api → dist/src/main.js)
                          frontend-f2hfresh (apps/web → next)
ecosystem.dev.config.cjs  the dev-mode equivalent
.github/workflows/deploy.yml
```

- The deploy workflow fires on a push to `main` or `dev`, SSHes to the server, and runs
  `deploy-f2hfresh.sh`. **It builds nothing and runs no tests** — CI is a delivery trigger, not a
  gate. The build gate is local; see `git-workflow`.
- A change to a PM2 `script`, `cwd`, `PATH`, or env block takes effect only after
  `pm2 reload ecosystem.config.js`. Confirm with `pm2 status` and `pm2 logs <app> --lines 50`
  rather than assuming.
- Because there is no pipeline gate, **NEVER** push a change to `main` you have not built locally.
  A broken build reaches production directly.
- Keep `docker-compose.yml` and `ecosystem.config.js` in step on env-var names, or local behavior
  diverges from production in ways that only show up after deploy.

## Environment separation

Distinguish three kinds of value and never confuse them:

| Kind | Reaches the image? | Example |
|---|---|---|
| Build-time configuration | Yes, baked in | Target platform, feature flag compiled into a bundle |
| Run-time configuration | No, injected at start | Database host, log level, feature toggles |
| Secrets | Never | Passwords, API keys, signing keys |

- **MUST** inject run-time configuration at container start, not at build. An image with an environment baked in cannot be promoted from staging to production.
- **NEVER** put a secret in a build argument. Build arguments are visible in image history.
- Anything inlined into a client bundle at build time is **public**. See the `security` skill.
- **MUST** validate required configuration at startup and fail immediately when it is missing. See the `backend-engineering` skill.

## Compose

Compose files are for local development and simple deployments. Treat them as configuration, not as documentation of production.

- The top-level `version:` key is obsolete in the current Compose specification. Do not add it; remove it only when otherwise editing the file.
- Name services for their role (`api`, `worker`, `db`), and depend on them explicitly.
- **MUST** use `depends_on` with a health condition, not bare `depends_on`, when start order matters. Bare `depends_on` waits for the container to start, not for the service inside it to be ready — the classic cause of "connection refused" on first run.
- Use named volumes for persistent data. **NEVER** point a bind mount at a path the container may delete or overwrite.
- **NEVER** commit real credentials into a compose file. Reference environment variables and ship a `.env.example`.
- Do not publish a database or cache port to the host in anything but local development.
- Pin image tags for the same reason as base images.

## CI pipelines

Structure a pipeline so failures are fast and legible:

```
install (cached)  →  format / lint / type check  →  test  →  build  →  deploy (gated)
```

- **MUST** run the same checks CI runs before claiming a change is complete locally. See the `agentic-development` skill.
- Cache the dependency directory keyed on the **lockfile hash**. A cache keyed on a branch name serves stale dependencies.
- **MUST** use the project's package manager and its frozen-lockfile install command so CI cannot silently resolve different versions than the lockfile specifies. See the `dependency-management` skill.
- Fail the pipeline on lint, type, and test failures. A check whose result is ignored is not a check.
- Keep deploy steps behind an explicit condition (a branch, a tag, or a manual approval). **NEVER** wire a deploy to run on every branch or on pull requests from forks.

### Pipeline security

These are the highest-severity defects in CI configuration, because the pipeline holds credentials to everything.

- **MUST grant least privilege to the pipeline token.** Default it to read-only and raise permissions per job only where a job needs to write. A pipeline that can push to the repository, publish packages, and deploy is a single compromise away from all three.
- **MUST pin third-party actions and reusable pipeline components to a full-length commit SHA.** A tag or branch reference is mutable: the upstream owner, or anyone who compromises that repository, can change what your pipeline executes. Verify the SHA belongs to the real repository and not a fork.
- **NEVER interpolate untrusted input directly into a shell step.** Pull request titles, branch names, issue bodies, and comment text are attacker-controlled. Interpolating them into a script is command injection into your CI environment. Pass the value through an intermediate environment variable and quote it, or use an action that takes it as a typed input.
- **NEVER check out and execute untrusted pull request code in a privileged workflow** — one triggered in a way that grants access to secrets. Separate the untrusted build from the privileged step so the two never share a token.
- **NEVER** print a secret, or a command whose arguments include one. Assume logs are readable by anyone with repository access, and that build logs persist.
- Prefer short-lived federated credentials over long-lived stored keys where the platform supports it.
- Avoid self-hosted runners for public repositories: they are not guaranteed to be clean or ephemeral, so untrusted code can persistently compromise them.
- **If a secret has been exposed in a log or an image, it MUST be rotated.** Deleting the log or rebuilding the image does not undo the exposure. See the `security` skill.

## Deployment

- **MUST** know whether the deployment replaces instances gradually or all at once before making a change that depends on it.
- **Old and new code will run simultaneously** during a rolling deploy. Every schema and contract change MUST be compatible with both. This is why renaming or dropping a column requires the expand-and-contract sequence — see the `database` skill.
- Run migrations as a separate, ordered step that completes before new code serves traffic, and make them safe to run concurrently or exactly once.
- **MUST** have a rollback path, and know whether it works. A deploy that cannot be reverted is not a deploy; it is a commitment. A schema change that drops data makes rollback impossible — that is a reason to stage it.
- Deploy behind a readiness signal that reflects dependency health, so traffic is not routed to an instance that cannot serve it.
- Handle shutdown: stop accepting new work, finish in-flight requests, close connections. Without this, every deploy drops requests.
- Prefer a feature flag over a deploy for enabling risky behavior, so enabling and shipping are separable.

## Anti-patterns

| Anti-pattern | Correct approach |
|---|---|
| Single-stage image containing the build toolchain | Multi-stage build |
| `COPY . .` before installing dependencies | Copy manifest and lockfile first |
| Missing `.dockerignore` | Add one before the first build |
| `FROM image:latest` | Pin a version or digest |
| Container running as root | Create and use a non-root user |
| Secret in `ENV`, `ARG`, or a copied file | Inject at run time or use a secret mount |
| Secret "removed" in a later layer | It is still in the image; rotate it |
| Baking environment configuration into the image | Inject at container start |
| Bare `depends_on` for a database | Depend on a health condition |
| Third-party action pinned to a tag or branch | Pin a full commit SHA |
| Pipeline token with blanket write access | Read-only by default, raise per job |
| Untrusted input interpolated into a `run` step | Intermediate environment variable |
| Checking out fork code in a privileged workflow | Separate untrusted build from privileged step |
| Deploy triggered on every branch | Gate on branch, tag, or approval |
| Schema change assuming only new code runs | Expand and contract |
| Deploying with no tested rollback | Establish one first |

## Related skills

- `security` — secrets, least privilege, exposure response.
- `database` — migration safety during a rolling deploy.
- `backend-engineering` — configuration validation, graceful shutdown, health checks.
- `dependency-management` — lockfiles and frozen installs in CI.
- `agentic-development` — CI as the authoritative validation gate.
