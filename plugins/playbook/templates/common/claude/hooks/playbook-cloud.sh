#!/bin/sh
# SessionStart hook: a Claude Code cloud session doesn't install the plugins
# this project enables, so fetch the playbook there and put its commands on
# PATH. Local sessions leave at once: the plugin is enabled in settings.json.
#
# The source comes from the cloud environment's variables, never from the
# repository: PLAYBOOK_SOURCE=<owner>/<repo>, or <owner>/<repo>@<branch or tag>
# to pin the version your machine runs. A failure only warns: the session
# still starts, without the autopilot.
[ "${CLAUDE_CODE_REMOTE:-}" = true ] || exit 0

src=${PLAYBOOK_SOURCE:-}
if [ -z "$src" ]; then
	echo "playbook: set PLAYBOOK_SOURCE=<owner>/<repo>[@ref] in this cloud environment's variables to run the autopilot here" >&2
	exit 0
fi
repo=${src%%@*}
ref=
case $src in *@*) ref=${src#*@} ;; esac

dir="$HOME/.playbook"
if [ ! -d "$dir/.git" ]; then
	if ! git clone -q --depth 1 ${ref:+--branch "$ref"} "https://github.com/$repo.git" "$dir"; then
		echo "playbook: could not clone github.com/$repo${ref:+ at $ref}" >&2
		exit 0
	fi
fi

plugin="$dir/plugins/playbook"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
	printf 'export PATH="%s/bin:$PATH"\nexport PLAYBOOK_PLUGIN_DIR="%s"\n' "$plugin" "$plugin" >>"$CLAUDE_ENV_FILE"
fi
