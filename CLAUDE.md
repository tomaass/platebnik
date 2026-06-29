# platebník

## Git workflow

- **`main` stays clean and is never edited directly** — only `git pull`. Every
  change lands on `main` through a pull request (squash-merge), never a direct
  commit.
- **Each task gets its own branch in its own git worktree** (an isolated
  working directory), and is merged into `main` via a PR.

### Why worktrees, not just branches

Multiple Claude sessions / terminal tabs often run in parallel on this repo. A
single checkout has **one HEAD**, so two tabs sharing the repo root fight over
the branch — a `git checkout` in one tab silently flips the branch under the
other, stranding commits on the wrong branch. Each parallel session must
therefore work in **its own worktree**, not the shared root checkout.

### How

- At the start of feature work in a fresh session, set up an isolated worktree
  **before editing** (use the `using-git-worktrees` skill / `EnterWorktree`).
  Worktrees live in `.claude/worktrees/`, which is gitignored.
- A branch can be checked out in **only one worktree at a time**
  (`fatal: '<branch>' is already used by worktree at …` otherwise).
- **After a PR merges, remove its worktree** (`git worktree remove <path>` or
  `ExitWorktree`). Orphaned worktrees accumulate and wedge future
  `git checkout main`.
- When you need to drop leftover edits to get a clean `main`, prefer
  `git stash push <file>` over discarding, so the work stays recoverable.

## Language conventions

- **English** for commit messages, PR titles/descriptions, and code comments.
- **Czech** for all user-facing UI copy.
