#!/bin/sh
# PreToolUse hook (Bash): refuse a command that both reaches a GitHub token
# and turns on output that would print it, and ask before `gh auth login`.
# Reads the tool call as JSON on stdin; prints a decision or nothing.
#
# No dependency beyond sh, grep and sed: with jq the command is extracted
# exactly, without it the raw JSON is matched, which can only match more.
# If stdin can't be read at all, it asks rather than allowing (fail closed).
input=$(cat) || input=''
if [ -z "$input" ]; then
	printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"Token guard could not read the command; check it yourself before allowing."}}'
	exit 0
fi
if command -v jq >/dev/null 2>&1; then
	cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null) || cmd=$input
else
	cmd=$input
fi

decide() {
	# $2 holds no double quotes or backslashes, so it embeds as-is.
	printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"%s","permissionDecisionReason":"%s"}}\n' "$1" "$2"
	exit 0
}

if printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]"])gh[[:space:]]+auth[[:space:]]+login'; then
	decide ask "gh auth login stores an account-wide token, which reaches every repository you own; the playbook keeps gh logged out and borrows a repo-scoped PAT per command (playbook-gh). Approve only if you mean to change that."
fi

token='git[[:space:]]+credential[[:space:]]+fill|gh[[:space:]]+auth[[:space:]]+token|GH_TOKEN=|GITHUB_TOKEN=|security[[:space:]]+find-(generic|internet)-password|playbook-gh'
printf '%s' "$cmd" | grep -qE "$token" || exit 0

if printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]"])(echo|printf|printenv|env|export -p|set)([[:space:]]|$).*(GH_TOKEN|GITHUB_TOKEN|password)|printenv[[:space:]]+(GH_TOKEN|GITHUB_TOKEN)'; then
	decide deny "Blocked: this command would print a GitHub token into the session transcript, which persists. Use playbook-gh without printing anything it borrows."
fi

debug='(^|[;&|[:space:]"])set[[:space:]]+-[a-z]*x|(^|[;&|[:space:]"])(ba|z)?sh[[:space:]]+-[a-z]*x|--debug|--verbose|GH_DEBUG|GIT_TRACE|GIT_CURL_VERBOSE|(^|[;&|[:space:]"])(curl|gh|playbook-gh)([[:space:]]+[^;&|]*)?[[:space:]]-[a-zA-Z]*v'
if printf '%s' "$cmd" | grep -qE "$debug"; then
	decide deny "Blocked: this command borrows the GitHub PAT and also turns on verbose, debug or trace output, which prints the Authorization header or the token into the session transcript. Re-run it without -v, --verbose, --debug, GH_DEBUG, GIT_TRACE or set -x."
fi
exit 0
