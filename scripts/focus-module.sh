#!/usr/bin/env bash
# focus-module.sh — Configure .claudeignore to focus on a single module
#
# Usage:
#   ./scripts/focus-module.sh agent       # Focus on agent module only
#   ./scripts/focus-module.sh billing     # Focus on billing module only
#   ./scripts/focus-module.sh reset       # Remove module focus, show everything
#   ./scripts/focus-module.sh             # Show current focus + list modules
#
# What it does:
#   Adds server/src/modules/* exclusions to .claudeignore, then un-ignores
#   the target module. This dramatically reduces Claude's context window
#   when working on a single domain.

set -euo pipefail
cd "$(dirname "$0")/.."

MODULES_DIR="server/src/modules"
IGNORE_FILE=".claudeignore"
MARKER_START="# >>> MODULE FOCUS (auto-generated — do not edit manually)"
MARKER_END="# <<< END MODULE FOCUS"

# List available modules
list_modules() {
  for d in "$MODULES_DIR"/*/; do
    basename "$d"
  done
}

# Remove any existing module focus block
remove_focus() {
  if grep -q "$MARKER_START" "$IGNORE_FILE" 2>/dev/null; then
    sed -i "/$MARKER_START/,/$MARKER_END/d" "$IGNORE_FILE"
    # Remove trailing blank lines
    sed -i -e :a -e '/^\n*$/{$d;N;ba' -e '}' "$IGNORE_FILE"
  fi
}

# Show current state
show_status() {
  if grep -q "$MARKER_START" "$IGNORE_FILE" 2>/dev/null; then
    focused=$(grep '^!' "$IGNORE_FILE" | grep 'modules/' | sed 's|.*modules/||;s|/.*||' | head -1)
    echo "Currently focused on: $focused"
  else
    echo "No module focus active (all modules visible)"
  fi
  echo ""
  echo "Available modules:"
  list_modules | sed 's/^/  /'
  echo ""
  echo "Usage: $0 <module-name>  or  $0 reset"
}

# No args — show status
if [ $# -eq 0 ]; then
  show_status
  exit 0
fi

TARGET="$1"

# Reset — remove focus
if [ "$TARGET" = "reset" ]; then
  remove_focus
  echo "Module focus removed — all modules visible to Claude"
  exit 0
fi

# Validate target
if [ ! -d "$MODULES_DIR/$TARGET" ]; then
  echo "Error: module '$TARGET' not found in $MODULES_DIR/"
  echo ""
  echo "Available modules:"
  list_modules | sed 's/^/  /'
  exit 1
fi

# Remove old focus block if present
remove_focus

# Append new focus block
cat >> "$IGNORE_FILE" <<EOF

$MARKER_START
# Ignore all modules except the focused one
server/src/modules/*/
!server/src/modules/$TARGET/
# Ignore old route/service shims (canonical code is in the module)
server/src/routes/
server/src/services/
server/src/repositories/
# Keep shared infra visible
!server/src/shared/
$MARKER_END
EOF

echo "Focused on module: $TARGET"
echo "Claude will now only see:"
echo "  - server/src/modules/$TARGET/"
echo "  - server/src/shared/"
echo "  - server/src/app.ts, index.ts, config.ts, db/, etc."
echo ""
echo "Run '$0 reset' to remove the focus"
