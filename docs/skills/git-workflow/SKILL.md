---
name: git-workflow
description: Use before, during, and after any change to a git repository, and whenever a git command would modify repository state. Covers checking status and branch before editing, keeping changes focused, inspecting the diff before finishing, writing commit messages, branch naming, and the destructive operations that require explicit permission - reset, checkout over local edits, clean, force push, history rewrite, stash drop, branch deletion. Triggers on "commit this", "create a branch", "what changed", "push", "rebase", "revert", "undo", "merge", "resolve conflicts", or any request that would discard, rewrite, or publish work. Also use to check for secrets and unintended files before a change leaves the working tree.
metadata:
  category: process
  version: "1.1.0"
---

# Git Workflow

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## Before changing anything

**MUST** run, and read the output:

```
git pull origin main      # ensure workspace is 100% up to date with remote
git status                # uncommitted work already present
git branch --show-current # which branch you are on
```

- **Always pull latest changes**: Never start coding on stale code. Always run `git pull origin main` first.
- **Uncommitted changes you did not make are the user's work.** Never revert, stash, discard, or overwrite them. Work alongside them, and keep your edits distinguishable.
- If you are on the default branch (`main`, `master`, `develop`) and the task is more than trivial, **SHOULD** create a branch first — but only if the project's workflow uses branches. Check whether the repo has other branches and how they are named.
- Inspect history when the change depends on prior intent: `git log --oneline -20`, `git log -p -- <path>`, `git blame <file>`. Read history when a line looks deliberate and you do not know why.

## Branch naming

Match existing branch names. If none exist, use `<type>/<short-description>` (`feat/invoice-export`, `fix/session-timeout`). Keep it lowercase and hyphenated.

## While working

- Keep the change **focused on the requested task**. One logical change per branch.
- **NEVER** modify files unrelated to the task — no drive-by refactors, renames, or reformatting.
- Do not run repository-wide formatters unless the project expects it, or you were asked. It buries your real change in noise.
- **NEVER** commit: secrets, `.env` files with real values, credentials, private keys, tokens; build output, caches, or dependency directories; personal editor or OS files; scratch and backup files.
- Check `.gitignore` before adding anything new. If a file should be ignored and is not, say so rather than committing it.

## Before finishing

**MUST** run and read in full:

```
git status                # untracked files you did not intend to add
git diff                  # every unstaged change
git diff --staged         # every staged change
```

Confirm:

- Every changed file relates to the task.
- No debug output, commented-out code, or temporary edits remain.
- No secrets appear anywhere in the diff.
- No generated or dependency files were added.

Then run the project's validation — see the `agentic-development` skill — and review the diff with the `code-review` skill.

## The workspace validation gate

**MUST** pass before pushing to `main`. Run from the repo root, and read the output rather than
just the exit code:

```
npm run build:api      # tsc for apps/api — must pass
npm run build:web      # next build for apps/web — must pass
pm2 status             # api-f2hfresh and frontend-f2hfresh must be online
```

Build both workspaces even when the change touched only one — `apps/web` consumes API types, and a
change on either side can break the other. A push to `main` or `dev` triggers the deploy workflow in
`.github/workflows/deploy.yml`, which SSHes to the server and runs `deploy-f2hfresh.sh`. There is no
build step in CI to catch what you did not: **the gate above is the only build verification before
production.**

If a build fails, fix it or stop. **NEVER** push past a failing build, and never report a task
complete on the strength of a build you did not run. See the `agentic-development` skill.

Flutter apps deploy separately (`npm run deploy:customer-web`, `npm run deploy:partner-web`) and are
not covered by the git push — say so explicitly when a mobile change is part of the work.

## Committing & Pushing

**MUST commit and push upon completion of every coding task.**

When committing & pushing:

- **MUST** stage all modified and newly created files completely using `git add -A` after inspecting `git status`.
- One logical change per commit with a clear, descriptive message.
- **MUST** push the committed work immediately to GitHub (`git push origin main`).
- **MUST NOT** amend, squash, or rewrite a commit that already exists on a remote without explicit permission.

### Commit messages

Match the project's existing style — read `git log --oneline -20` first. If the repo already uses Conventional Commits, follow it; if it does not, do not impose it.

Conventional Commits format, when applicable:

```
<type>(<optional scope>): <imperative summary, ~72 chars or less>

<body: why the change was needed and what approach was taken>

<footer: BREAKING CHANGE: ... / Refs: #123>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.

- Summary in the imperative mood: "add retry to webhook delivery", not "added" or "adds".
- The body explains **why**, not what — the diff already shows what.
- **NEVER** describe changes the commit does not contain, and never overstate what was verified.

## Operations requiring explicit permission

**MUST NOT** run any of these without the user asking for that specific effect. Each can destroy work that cannot be recovered.

| Operation | Destroys |
|---|---|
| `git reset --hard` | All uncommitted work in the tree |
| `git checkout -- <path>` / `git restore <path>` | Uncommitted edits to those files |
| `git clean -fd` | Untracked files, including ones never backed up |
| `git push --force` / `--force-with-lease` | Remote history and others' work |
| `git rebase` on shared history | Published history |
| `git commit --amend` on a pushed commit | Published history |
| `git stash drop` / `git stash clear` | Stashed work |
| `git branch -D` | Unmerged commits |
| `git reflog expire` / `git gc --prune` | The recovery path itself |

Also requiring explicit permission: pushing to a shared or protected branch, creating or merging a pull request, tagging or publishing a release, and changing remotes or repository settings.

When one of these is genuinely the right move, say what it will do and what will be lost, then wait.

## Merges and conflicts

- Resolve conflicts by **understanding both sides**. Read the surrounding code and, when unclear, the commits that introduced each side.
- **NEVER** resolve a conflict by taking one side wholesale to make it compile. That silently deletes the other side's intent.
- After resolving, run the full validation suite. Conflict resolution frequently produces code that compiles but is wrong.
- If a resolution requires a decision about intent that you cannot determine from the code, ask.

## Undoing work safely

Prefer operations that add history over those that erase it.

- To undo a **published** commit: `git revert <sha>` — it creates a new commit and preserves history.
- To undo **local, uncommitted** work: this destroys data; confirm with the user first.
- To recover something apparently lost: `git reflog` before concluding it is gone.

## Multi-Repository & Subdirectory Dual-Push Policy

In this workspace (`GotIt-App`), multiple git remote repositories exist:
- **Primary Monorepo (`origin`)**: `git@github.com:hipartner/gotit-app.git`
- **Standalone App Remote (`rk-devices`)**: `git@github.com:hipartner/rk-devices.git`

### Dual-Push Rules:
1. **Workspace Commits:** Every commit across the monorepo MUST be pushed to `origin main`.
2. **App Subdirectory Dual-Sync:** Any changes affecting the `/app` directory (the Flutter application) MUST be pushed to BOTH remotes (`origin` monorepo AND `rk-devices` standalone app repo).
3. **Subtree Push Commands:**
   ```bash
   # Push monorepo to origin
   git push origin main

   # Split & push /app directory to standalone rk-devices repo
   git subtree split --prefix=app -b flutter-app-standalone
   git push rk-devices flutter-app-standalone:main
   ```
   Or directly:
   ```bash
   git subtree push --prefix=app rk-devices main
   ```

## Related skills

- `code-review` — what to look for in the diff you just inspected.
- `security` — what counts as a secret, and what to do if one was committed.
- `project-structure` — which files should never enter the repository.

