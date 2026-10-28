#!/usr/bin/env bash
set -euo pipefail

if ! command -v tmux >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y tmux
fi

if [[ ! -x "$HOME/.opencode/bin/opencode" ]] && ! command -v opencode >/dev/null 2>&1; then
  curl -fsSL https://opencode.ai/install | bash
fi

if ! grep -Fq '# OpenCode devcontainer aliases' "$HOME/.bashrc"; then
  cat >> "$HOME/.bashrc" <<'EOF'

export PATH="$HOME/.opencode/bin:$PATH"
alias opencode-web='tmux has-session -t opencode-web 2>/dev/null || tmux new-session -d -s opencode-web "opencode web --hostname 0.0.0.0 --port 4096"'
alias tmux-kill-all='tmux kill-server'
# OpenCode devcontainer aliases
EOF
fi

if ! grep -Fq "alias expo-web=" "$HOME/.bashrc"; then
  cat >> "$HOME/.bashrc" <<'EOF'

alias expo-web='npm run web --workspace app -- --port 5000 --host lan'
EOF
fi
