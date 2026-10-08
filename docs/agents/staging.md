# Staging: squash dev before merging to main

`dev` collects many small commits (feature, review fixes, issue tracker updates). Before work reaches `main`, it is squashed on a `stage` branch into a few commits (4-5 max). `dev` is not touched during staging.

## Flow

1. **Check `dev` is clean.** `git status` on `dev` shows nothing. Commit or ask first.
2. **Create `stage` from `dev`.** If `stage` already exists from a past round, delete and recreate it.
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
7. **Merge.** Fast-forward `main` to `stage` (`git checkout main && git merge --ff-only stage`) when the user asks. Then reset `dev` to `main` so the next round starts clean.
