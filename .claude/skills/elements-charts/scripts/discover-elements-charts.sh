#!/usr/bin/env bash
# Discover installed Elements Charts package, exports, palettes, and types.
# Outputs a structured report for use during skill Phase 1: Discovery.
#
# Usage: bash scripts/discover-elements-charts.sh [project-root]
# If project-root is omitted, searches from current directory.

set -euo pipefail

ROOT="${1:-.}"

# --- Find package.json ---
PKG=""
for dir in "" "frontend/" "app/" "src/"; do
  if [[ -f "$ROOT/${dir}package.json" ]]; then
    PKG="$ROOT/${dir}package.json"
    break
  fi
done

if [[ -z "$PKG" ]]; then
  echo "ERROR: No package.json found in $ROOT (checked root, frontend/, app/, src/)" >&2
  exit 1
fi

PROJECT="$(cd "$(dirname "$PKG")" && pwd)"
echo "=== Elements Charts Discovery ==="
echo "Project: $PROJECT"
echo ""

# --- Check elements-charts is installed ---
NAME="@sanofi-accelerator/elements-charts"
VERSION=$(grep -o "\"$NAME\": *\"[^\"]*\"" "$PKG" 2>/dev/null | head -1 | sed 's/.*: *"\(.*\)"/\1/' || true)

if [[ -z "$VERSION" ]]; then
  echo "ERROR: $NAME not found in $PKG" >&2
  echo ""
  echo "To install: npm install $NAME"
  echo ""
  # Check if base elements is installed (charts is often used alongside it)
  BASE_VER=$(grep -o '"@sanofi-accelerator/elements": *"[^"]*"' "$PKG" 2>/dev/null | head -1 | sed 's/.*: *"\(.*\)"/\1/' || true)
  if [[ -n "$BASE_VER" ]]; then
    echo "Note: @sanofi-accelerator/elements@$BASE_VER is installed."
    echo "Charts is a separate package — add it to your dependencies."
  fi
  exit 1
fi

echo "== $NAME@$VERSION =="

# --- Discover barrel exports ---
BARREL="$PROJECT/node_modules/$NAME/dist/src/index.d.ts"
ALT_BARREL="$PROJECT/node_modules/$NAME/dist/index.d.ts"

if [[ ! -f "$BARREL" ]] && [[ -f "$ALT_BARREL" ]]; then
  BARREL="$ALT_BARREL"
fi

if [[ -f "$BARREL" ]]; then
  echo "  Barrel: $BARREL"
  echo ""

  # Extract all exported names
  NAMES=$(sed 's/[,{}]/ /g; s/export//g; s/type//g; s/declare//g; s/from [^;]*//g' "$BARREL" \
    | grep -oE '\b[A-Z][A-Za-z0-9_]+\b' \
    | sort -u)

  if [[ -n "$NAMES" ]]; then
    COUNT=$(echo "$NAMES" | wc -l | tr -d ' ')
    echo "  Total exports: $COUNT"
    echo ""

    # Group by category
    CHARTS=$(echo "$NAMES" | grep -iE '(Chart|Plot|Map)$' | grep -vE '(Props|Data|Series|Point|Config|Style|Content|Cell|Selected|Selection|Locale)' || true)
    TYPES=$(echo "$NAMES" | grep -E '(Props|Data|Series|Point|Config|Style|Content|Cell|Selected|Selection|Locale)' || true)
    PALETTES=$(echo "$NAMES" | grep -iE '(PALETTE|COLOR)' || true)
    HOOKS=$(echo "$NAMES" | grep -E '^use' || true)
    SHAPES=$(echo "$NAMES" | grep -iE '(Shape|Point)' | grep -vE '(Props|Data)' || true)
    UTILS=$(echo "$NAMES" | grep -iE '(format|get|locale|LOCALES)' | grep -vE '(Props|Data|Config)' || true)

    INDENT='s/^/    - /'
    [[ -n "$CHARTS" ]] && echo "  Chart Components:" && echo "$CHARTS" | sed "$INDENT"
    [[ -n "$PALETTES" ]] && echo "  Color Palettes:" && echo "$PALETTES" | sed "$INDENT"
    [[ -n "$TYPES" ]] && echo "  Types/Interfaces:" && echo "$TYPES" | sed "$INDENT"
    [[ -n "$HOOKS" ]] && echo "  Hooks:" && echo "$HOOKS" | sed "$INDENT"
    [[ -n "$SHAPES" ]] && echo "  Point Shapes:" && echo "$SHAPES" | sed "$INDENT"
    [[ -n "$UTILS" ]] && echo "  Utilities:" && echo "$UTILS" | sed "$INDENT"
    echo ""
  fi

  # Show full barrel content for reference
  echo "  --- Full barrel file (for precise API) ---"
  cat "$BARREL"
  echo ""
  echo "  --- End barrel file ---"
else
  echo "  WARNING: Barrel file not found at $BARREL"
  echo "  Run: npm install (or yarn/pnpm install)"
  echo ""
  echo "  Falling back to reference documentation in references/ directory."
fi

# --- Check for styles.css ---
STYLES="$PROJECT/node_modules/$NAME/styles.css"
ALT_STYLES="$PROJECT/node_modules/$NAME/dist/styles.css"

if [[ -f "$STYLES" ]]; then
  echo "  Stylesheet: $STYLES"
  echo "  Import as: import \"$NAME/styles.css\";"
elif [[ -f "$ALT_STYLES" ]]; then
  echo "  Stylesheet: $ALT_STYLES"
  echo "  Import as: import \"$NAME/dist/styles.css\";"
else
  echo "  No standalone stylesheet found (may be bundled or not needed)."
fi
echo ""

# --- Check companion packages ---
echo "== Companion Packages =="
for pkg in "elements" "elements-table" "elements-editor"; do
  COMPANION="@sanofi-accelerator/$pkg"
  COMP_VER=$(grep -o "\"$COMPANION\": *\"[^\"]*\"" "$PKG" 2>/dev/null | head -1 | sed 's/.*: *"\(.*\)"/\1/' || true)
  if [[ -n "$COMP_VER" ]]; then
    echo "  $COMPANION@$COMP_VER"
  fi
done
echo ""

echo "=== Discovery complete. Use barrel file above for precise API of installed version. ==="
