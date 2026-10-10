# Rulesets for dev and stage

Status: ready-for-human

From issue 03. GitHub settings only. `dev` and `stage` are part of the staging flow (`docs/agents/staging.md`), so they get protection too.

## Problem

Issue 03 protects `main` and `v*` tags. `dev` and `stage` have no rules. Anything with write access can force-push or delete them: a GitHub App, an Actions token, a leaked token. `dev` holds work that is not on `main` yet.

Both branches are rewritten on purpose:

- `stage` is force-pushed each staging round (step 9) and deleted after the merge (step 10).
- `dev` is force-pushed after staging (step 10), and after a reorder.

So force pushes and deletions can't be blocked for you. They can be blocked for everyone else.

## Fix

GitHub → Settings → Rules → Rulesets → New branch ruleset:

1. Name `dev and stage`, enforcement Active.
2. Targets: include by pattern `dev` and `stage`.
3. Bypass list: Repository admin, mode Always.
4. Rules: Restrict deletions, Block force pushes.
5. Leave off: Restrict updates, Require a pull request, Require status checks. Dependabot PRs merge into `dev`, and `stage` gets direct pushes. CI runs on the `stage` push anyway.

Keep it separate from the `main` ruleset: `main` blocks force pushes for everyone, admin included.

## Acceptance

- From a token or account without admin (or with the bypass temporarily removed): `git push --force origin dev` is rejected.
- Your normal flow still works: `git push --force-with-lease origin dev`, `git push --force-with-lease origin stage`, `git push origin --delete stage`.
- A Dependabot PR into `dev` still merges.

## Notes

The bypass covers your own tokens too: a leaked admin PAT can still force-push. The rules stop other actors and accidental pushes from apps or workflows, not you.
