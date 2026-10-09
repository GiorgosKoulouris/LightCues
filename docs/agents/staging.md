# Staging: squash dev before merging to main

`dev` collects many small commits (feature, review fixes, issue tracker updates). Before work reaches `main`, it is squashed on a `stage` branch into a few commits (4-5 max over `main`).

A request can **hold back** commits: they stay on `dev`, unstaged, on top of `stage` (for example: "stage everything except the security scan commit"). After staging, `dev` is always `stage` plus the held-back commits, with nothing lost.

If the batch is a release, run the [Changelog review](releasing.md#changelog-review) and bump the version on `dev` first. Move the `## [Unreleased]` lines of CHANGELOG.md under the new version heading in the same commit. Tag after the merge. See [releasing.md](releasing.md).

## Safety nets

These apply to every run, whatever the request:

- **Plan first.** Before any rewrite, show the user the groups, the held-back commits and each commit message. Rewrite only after they say go.
- **Backup tag.** Before each rewrite of `dev` or `stage`, tag its current tip: `git tag backup/<branch>-<step> <tip>`. Leave the tags in place and tell the user how to delete them.
- **Dry run.** A reorder runs first in a throwaway worktree in the scratchpad. `dev` moves only once the dry run applies cleanly and its tree equals `dev`.
- **Same tree.** After every rewrite, `git diff <backup tag> dev` is empty.
- **Local only.** Push and merge only when the user asks.

## Flow

1. **Check `dev` is clean.** `git status` on `dev` shows nothing. Commit or ask first.
2. **Find the base.** If `stage` exists, is ahead of `main` and is an ancestor of `dev` (`git merge-base --is-ancestor stage dev`), it holds an unmerged batch: the new groups go on top of it, and its commits stay as they are. Otherwise the base is `main`, and stale `stage` is replaced.
3. **Pick the groups.** List the commits with `git log --oneline --reverse <base>..dev`. Split them into consecutive ranges by theme (for example: by spec, or by a block of issues). Note the last commit of each range. Mark the held-back commits.
4. **Move held-back commits to the top.** Skip if they are already the newest commits on `dev`. Otherwise, check that nothing staged touches their files (`git log <held>..dev -- <their paths>` is empty). Then dry-run the new order in a worktree, and only then rebuild `dev` from the last commit before the first moved one:
   ```sh
   git tag backup/dev-pre-reorder dev
   git reset --hard <last unmoved commit>
   git cherry-pick <staged commits in order> <held-back commits in order>
   git diff backup/dev-pre-reorder dev   # must be empty
   ```
5. **Build the groups on the base.** For each group, make one commit whose tree is the tree of the group's last commit. This keeps every file exactly as it was in `dev`, with no conflicts to resolve.
   ```sh
   git tag backup/stage-pre-squash stage   # if stage exists
   parent=$(git rev-parse <base>)
   # for each group: <last> = last commit of the group, <msg> = message file
   parent=$(GIT_AUTHOR_DATE="$(git log -1 --format=%aI <last>)" \
     git commit-tree "<last>^{tree}" -p "$parent" -F <msg>)
   # after the last group
   git branch -f stage "$parent"
   ```
   If `main` has moved since `dev` branched, first run `git rebase main` on `stage`, then squash with `git rebase -i main` instead.
6. **Put the held-back commits back on `dev`.** Skip if none are held back.
   ```sh
   git tag backup/dev-pre-stage dev
   git reset --hard stage
   git cherry-pick <held-back commits in order>
   ```
   With nothing held back, `dev` stays as it is.
7. **Commit messages.** One subject line, then a short body listing what the group adds. The author is the user, from git config. Strip `Co-Authored-By: Claude` and every other AI trailer. Held-back commits keep their messages until they are staged.
8. **Check nothing is lost.**
   ```sh
   git diff stage dev~<held-back count>   # must be empty
   git diff backup/dev-pre-stage dev      # must be empty (when commits are held back)
   git log --format=%B main..stage | grep -i co-authored   # must be empty
   git log --oneline main..stage          # 4-5 commits at most
   ```
9. **Push `stage` and wait for CI.** Only when the user asks.
   ```sh
   git push --force-with-lease origin stage
   ```
   The push runs CI (see [docs/development.md § CI](../development.md#ci)). Wait for a green run. If the batch touches the app, download the `LightCues-Setup-<version>` artifact from the run (kept 7 days), install it on Windows and check the app starts.
10. **Merge and clean up.** When the user asks: fast-forward `main` to `stage` (`git checkout main && git merge --ff-only stage`) and push `main`. Then:
    - With nothing held back, reset `dev` to `main`.
    - With commits held back, leave `dev` as it is: it already sits on `main`. Resetting would drop the held-back commits.

    Push `dev` with `--force-with-lease` if it is on the remote. Delete `stage` locally and on the remote (`git branch -d stage && git push origin --delete stage`). `stage` exists only for the squash and its CI run.
11. **Tag, if this is a release.** See [releasing.md](releasing.md).
