# Git Commit and Push

Automatically stage all changes, create a commit with an AI-generated message, and push to the remote repository.

## Instructions

1. Run `git status` to see all changed files (never use -uall flag)
2. Run `git diff` to see the actual changes (both staged and unstaged)
3. Run `git log -5 --oneline` to see recent commit style
4. Analyze the changes and generate a concise, meaningful commit message that:
   - Summarizes what changed and why
   - Follows the repository's existing commit message style
   - Is 1 sentence maximum
   - Uses imperative mood (e.g., "Add feature" not "Added feature")
5. Stage all changes with `git add -A`
6. Create the commit:
   ```bash
   git commit -m "Your commit message here"
   ```
7. Push to the remote with `git push`
8. Report the commit hash and confirm success

## Important

- Do NOT push to main/master with --force
- Do NOT skip pre-commit hooks
- If there are no changes to commit, inform the user and stop
- If push fails due to remote changes, inform the user rather than force pushing
