#!/usr/bin/env bash
# Discover installed Elements packages, exports, and design tokens.
# Outputs a structured report for use during skill Phase 1: Discovery.
#
# Usage: bash scripts/discover-elements.sh [project-root]
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
echo "=== Elements Discovery ==="
echo "Project: $PROJECT"
echo ""

# --- Introspection manifest (Tier 1) ---
# The core package ships dist/introspect.json plus an `elements-introspect` bin
# from v3 on. When present it is the source of truth: compiler-resolved props,
# real enum members, hook signatures, tokens, icons. Availability only — the
# caller issues the targeted queries (see references/introspect-cli.md), so this
# script's output stays bounded.
# The core package ships the CLI from v3.50.0. Probe unconditionally so
# workspace roots and projects whose only direct dep is elements-table also
# get a signal (AVAILABLE or NOT AVAILABLE) rather than silence.
INTROSPECT_BIN="$PROJECT/node_modules/.bin/elements-introspect"
INTROSPECT_JSON="$PROJECT/node_modules/@sanofi-accelerator/elements/dist/introspect.json"

if [[ -x "$INTROSPECT_BIN" ]]; then
  echo "== Introspection manifest: AVAILABLE =="
  echo "  CLI: $INTROSPECT_BIN"
  if [[ -f "$INTROSPECT_JSON" ]]; then
    echo "  Manifest: $INTROSPECT_JSON"
  fi
  echo "  PREFERRED source of truth. Run from $PROJECT (or pass --dist)."
  echo "  Procedure: references/introspect-cli.md"
  echo "  Next: \"$INTROSPECT_BIN\" components"
  echo "        \"$INTROSPECT_BIN\" props <Component>"
  echo "        \"$INTROSPECT_BIN\" enum <EnumName>"
elif [[ -f "$INTROSPECT_JSON" ]]; then
  echo "== Introspection manifest: AVAILABLE (no bin) =="
  echo "  Manifest: $INTROSPECT_JSON"
  echo "  The bin is missing but the manifest is installed. Point any available"
  echo "  elements-introspect at it explicitly:"
  echo "    elements-introspect props <Component> --dist \"$(dirname "$INTROSPECT_JSON")\""
  echo "  Procedure: references/introspect-cli.md"
else
  echo "== Introspection manifest: NOT AVAILABLE =="
  if [[ -d "$PROJECT/node_modules/@sanofi-accelerator/elements" ]]; then
    echo "  Reason: installed version predates the introspect manifest (v3.50.0+)."
    echo "  Optional: npm install @sanofi-accelerator/elements@latest"
  else
    echo "  Reason: @sanofi-accelerator/elements is not installed in node_modules."
    echo "  Run: npm install (or yarn/pnpm install)"
  fi
  echo "  Falling back to the barrel index.d.ts exports listed below (Tier 2)."
fi
echo ""
# --- Discover installed packages ---
PACKAGES=("elements" "elements-charts" "elements-table" "elements-editor")
FOUND_ANY=false

for pkg in "${PACKAGES[@]}"; do
  NAME="@sanofi-accelerator/$pkg"
  VERSION=$(grep -o "\"$NAME\": *\"[^\"]*\"" "$PKG" 2>/dev/null | head -1 | sed 's/.*: *"\(.*\)"/\1/' || true)

  if [[ -z "$VERSION" ]]; then
    continue
  fi

  FOUND_ANY=true
  echo "== $NAME@$VERSION =="

  # Try package manager resolution first (works with pnpm, yarn pnp, monorepos)
  BARREL=""
  if command -v node &>/dev/null; then
    BARREL=$(node -e "try{console.log(require.resolve('$NAME/dist/src/index.d.ts'))}catch{}" 2>/dev/null || true)
  fi
  # Fall back to direct node_modules path
  if [[ -z "$BARREL" ]]; then
    BARREL="$PROJECT/node_modules/$NAME/dist/src/index.d.ts"
  fi
  if [[ -f "$BARREL" ]]; then
    # Extract exported names from barrel file
    NAMES=$(sed 's/[,{}]/ /g; s/export//g; s/type//g; s/declare//g; s/from [^;]*//g' "$BARREL" \
      | grep -oE '\b[A-Z][A-Za-z0-9_]+\b' \
      | sort -u)

    if [[ -n "$NAMES" ]]; then
      COUNT=$(echo "$NAMES" | wc -l | tr -d ' ')
      echo "  Barrel: $BARREL"
      echo "  Exports ($COUNT):"

      # Group by likely type
      COMPONENTS=$(echo "$NAMES" | grep -vE '(Variant|Size|State|Type|Color|Position|Density|Decoration|Padding|Props|Enum|Weight|Style)$' | grep -vE '^(use|Icon(Name|Position))' || true)
      ENUMS=$(echo "$NAMES" | grep -E '(Variant|Size|State|Type|Color|Position|Density|Decoration|Padding|Weight|Style)$' || true)
      HOOKS=$(echo "$NAMES" | grep -E '^use' || true)

      [[ -n "$COMPONENTS" ]] && echo "    Components: $(echo $COMPONENTS | tr '\n' ', ' | sed 's/,$//')"
      [[ -n "$ENUMS" ]] && echo "    Enums: $(echo $ENUMS | tr '\n' ', ' | sed 's/,$//')"
      [[ -n "$HOOKS" ]] && echo "    Hooks: $(echo $HOOKS | tr '\n' ', ' | sed 's/,$//')"
    fi
  else
    echo "  WARNING: node_modules not found at $BARREL"
    echo "  Run: npm install (or yarn/pnpm install)"
  fi
  echo ""
done

if [[ "$FOUND_ANY" == false ]]; then
  echo "No @sanofi-accelerator/elements* packages found in $PKG"
  echo "Available packages: elements, elements-charts, elements-table, elements-editor"
  exit 1
fi

# --- Design tokens summary ---
# Since v3, tokens live in dist/assets/css/styles/theme-*.css (dist/styles.css
# is a backward-compat stub with no token definitions).
THEME_DIR="$PROJECT/node_modules/@sanofi-accelerator/elements/dist/assets/css/styles"
LEGACY_CSS="$PROJECT/node_modules/@sanofi-accelerator/elements/dist/styles.css"

# Pick the right source: prefer theme dir (v3+), fall back to legacy CSS
if [[ -d "$THEME_DIR" ]] && compgen -G "$THEME_DIR/theme-*.css" > /dev/null 2>&1; then
  STYLES_GLOB="$THEME_DIR/theme-*.css"
  STYLES_SOURCE="$THEME_DIR/theme-*.css"
  ALL_TOKENS=$(cat "$THEME_DIR"/theme-*.css 2>/dev/null | grep -oE '\-\-elements-[a-zA-Z0-9-]+' | sort -u)
elif [[ -f "$LEGACY_CSS" ]]; then
  STYLES_SOURCE="$LEGACY_CSS"
  ALL_TOKENS=$(grep -oE '\-\-elements-[a-zA-Z0-9-]+' "$LEGACY_CSS" 2>/dev/null | sort -u)
fi

if [[ -n "${ALL_TOKENS:-}" ]]; then
  TOTAL=$(echo "$ALL_TOKENS" | wc -l | tr -d ' ')
  echo "== Design Tokens ($TOTAL unique) =="
  echo "  Source: $STYLES_SOURCE"

  # Dynamically discover token categories
  CATEGORIES=$(echo "$ALL_TOKENS" \
    | sed 's/--elements-//' \
    | sed 's/-[a-z0-9]*$//' \
    | sort -u)

  for cat in $CATEGORIES; do
    COUNT=$(echo "$ALL_TOKENS" | grep -c "^--elements-${cat}" 2>/dev/null || true)
    if [[ "$COUNT" -gt 0 ]]; then
      echo "  $cat: $COUNT tokens"
    fi
  done
  echo ""
elif [[ -d "$PROJECT/node_modules/@sanofi-accelerator/elements" ]]; then
  echo "== Design Tokens =="
  echo "  WARNING: No token CSS files found. Run npm install or npm run build."
  echo ""
fi

echo "=== Discovery complete. Read barrel index.d.ts files above for full API. ==="
