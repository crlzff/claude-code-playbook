# GitHub repository setup

Done once per project, in the browser and your own terminal.
`boot` prints this list and checks what it can; it never handles the token.
Never paste a token into a Claude session.

1. **Create the repository** on GitHub, private, empty (no README, no
   licence: the first push brings everything).
2. **Pull requests settings** (Settings → General → Pull Requests):
   - allow squash merging only; untick merge commits and rebase merging;
   - squash default commit message: **Pull request title** (a merge made
     on GitHub skips the local commit-msg hook, and the default adds
     `Co-authored-by` trailers);
   - tick "Automatically delete head branches".
3. **Security** (Settings → Code security): Dependabot alerts and
   Dependabot security updates on.
4. **Protection.** Profile `git.protection: ruleset` (public repository or a
   paid plan): a ruleset on the main branch requiring a PR and the `ci`
   check. `pre-push` (free private repository): nothing on GitHub; the
   local hook and reading CI before merging are the gate.
5. **PAT**: a fine-grained token
   (Settings → Developer settings → Fine-grained tokens), **this
   repository only**, expiry 90 days, permissions: Contents read and
   write, Pull requests read and write, Actions read, Metadata read,
   Workflows read and write (only if Claude may edit `.github/workflows`).
   Store it in your OS credential store **for this repository's path**
   (git's credential helper: the keychain on macOS), from your
   own terminal inside the repository (the shell's history should not
   keep it: a leading space with `HIST_IGNORE_SPACE`, or type it at the
   prompt git shows):

   ```sh
   git config credential.useHttpPath true
   git push -u origin main   # git asks once: username anything, password the PAT
   ```

   `credential.useHttpPath` keys the stored entry by repository, so each
   project keeps its own PAT and one doesn't overwrite another. It is set
   in this repository only: a global setting would hide the entries other
   repositories stored without a path. `playbook-gh` looks the token up the
   same way. When it expires: a new token, then
   `printf 'protocol=https\nhost=github.com\npath=<owner>/<repo>.git\n\n' | git credential reject`
   and push again.
   *Not yet tried end to end:* if the push answers 403 instead of asking,
   an older stored entry for github.com without a path answered first:
   query your credential helper by hand to see which entry answers.
6. **Hooks**: `git config --get core.hooksPath` prints `.githooks` (boot sets
   it; a stack pack also sets it from its install step for fresh clones).
7. **Cloud autopilot** (optional, only to run `/autopilot-run` in a Claude
   Code cloud session). A cloud session doesn't install the project's
   plugins, so the hook boot writes (`.claude/hooks/playbook-cloud.sh`)
   fetches the playbook. In the cloud environment's settings on claude.ai:
   - one environment variable, `PLAYBOOK_SOURCE=<owner>/<repo>` of the
     playbook you installed (`@<branch or tag>` pins a version);
   - nothing else: no PAT, no other token, no real secret. The session's
     GitHub proxy pushes and opens PRs with the credential it holds outside
     the VM; that credential reaches every repository your GitHub
     connection can, so restrict the connection on GitHub's side if that is
     more than this one.

   Only REST calls go through the proxy: merging (`/merge-stack`, `/done`)
   stays on your machine.
