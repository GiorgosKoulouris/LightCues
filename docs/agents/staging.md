# Staging: squash dev before merging to main

`dev` collects many small commits (feature, review fixes, issue tracker updates). Before work reaches `main`, it is squashed on a `stage` branch into a few commits (4-5 max). `dev` is not touched during staging.

If the batch is a release, bump the version on `dev` first and tag after the merge. See [releasing.md](releasing.md).

## Flow

1. **Check `dev` is clean.** `git status` on `dev` shows nothing. Commit or ask first.
2. **Create `stage` from `dev`.**
   ```sh
   git branch -f stage dev
   ```
3. **Pick the groups.** List the commits with `git log --oneline --reverse main..dev`. Split them into 4-5 consecutive ranges by theme (for example: by spec, or by a block of issues). Note the last commit of each range. Show the grouping to the user before rewriting.
4. **Rebuild `stage` on `main`.** For each group, make one commit whose tree is the tree of the group's last commit. This keeps every file exactly as it was in `dev`, with no conflicts to resolve.
   ```sh
   parent=$(git rev-parse main)
   # for each group: <last> = last commit of the group, <msg> = message file
   parent=$(GIT_AUTHOR_DATE="$(git log -1 --format=%aI <last>)" \
     git commit-tree "<last>^{tree}" -p "$parent" -F <msg>)
   # after the last group
   git branch -f stage "$parent"
   ```
   If `main` has moved since `dev` branched, first run `git rebase main` on `stage`, then squash with `git rebase -i main` instead.
5. **Commit messages.** One subject line, then a short body listing what the group adds. No `Co-Authored-By: Claude` or other AI trailers. Author is the user.
6. **Verify nothing is lost.**
   ```sh
   git diff dev stage                 # must be empty
   git log --format=%B main..stage | grep -i co-authored   # must be empty
   git log --oneline main..stage      # 4-5 commits
   ```
7. **Push `stage` and wait for CI.**
   ```sh
   git push --force-with-lease origin stage
   ```
   The push runs CI (see [README § CI](../../README.md#ci)). Wait for a green run. If the batch touches the app, download the `LightCues-Setup-<version>` artifact from the run (kept 7 days), install it on Windows and check the app starts.
8. **Merge and clean up.** When the user asks: fast-forward `main` to `stage` (`git checkout main && git merge --ff-only stage`), push `main`, reset `dev` to `main` (and `git push --force-with-lease origin dev` if `dev` is on the remote), then delete `stage` locally and on the remote (`git branch -d stage && git push origin --delete stage`). `stage` exists only for the squash and its CI run.
9. **Tag, if this is a release.** See [releasing.md](releasing.md).
