# Rulesets for main and v* tags

Status: resolved

See spec, "Decisions". GitHub settings only.

## Fix

GitHub → Settings → Rules → Rulesets:

1. Branch ruleset `main`: target the default branch. Block force pushes, restrict deletions. Leave direct pushes allowed: the staging flow pushes `stage` merges to `main` (see `docs/agents/staging.md`). Require the `ci` status check for pull requests only.
2. Tag ruleset `v*`: restrict creations, updates and deletions. Add yourself (repository admin) to the bypass list, so you can still push release tags.

Check `stage` is not covered: it is force-pushed each round.

## Acceptance

- A test force-push to `main` from a scratch clone is rejected.
- A test `git push origin v0.0.0-test` from a non-bypass token is rejected. Delete the test tag if it got through.
- Your normal release (`docs/agents/releasing.md`) still works. Note it in the comments after the next release.

## Comments

2026-10-10: marked resolved by the maintainer. Rulesets set in GitHub settings.
