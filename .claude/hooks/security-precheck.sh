#!/bin/bash
# PreToolUse Security Gate for Claude Code — Agentin
# Reads CLAUDE_TOOL_INPUT from env (set by Claude Code before hook runs)
INPUT="${CLAUDE_TOOL_INPUT:-}"

blocked() {
  echo "🚫 SECURITY GATE: $1" >&2
  exit 1
}

# Block pipe-to-shell patterns
echo "$INPUT" | grep -qE "(curl|wget).*\|.*(bash|sh|zsh|fish)" && blocked "pipe-to-shell detected"

# Block .env reads via bash
echo "$INPUT" | grep -qE "(cat|head|tail|less|more|nano|vim).*\.env" && blocked ".env read via bash"

# Block secrets file read
echo "$INPUT" | grep -q "agentin-secrets" && blocked "secrets file access"

# Block SSH key reads
echo "$INPUT" | grep -qE "(cat|head).*\.(pem|key|rsa|ed25519)" && blocked "key file read"

# Block destructive rm on critical paths
echo "$INPUT" | grep -qE "rm\s+-rf\s+(\/|~|\$HOME|/root)" && blocked "destructive rm on critical path"

# Block SQL destructive ops
echo "$INPUT" | grep -qiE "(DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM.*WHERE\s+1)" && blocked "destructive SQL"

exit 0
