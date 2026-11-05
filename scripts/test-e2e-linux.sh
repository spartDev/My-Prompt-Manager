#!/usr/bin/env bash
# Runs e2e specs the way Linux CI renders them: in the Playwright noble image, with the DejaVu fonts of
# ubuntu-latest, which are wider than the Mac fonts, so a title that fits on the Mac can wrap here.
# It runs the committed HEAD (git archive), not the working tree: commit what you want to test.
# The image tag is the @playwright/test version of package.json. Needs Docker.
#
# Usage: npm run test:e2e:linux -- <spec>... [playwright test options]
# Test output (failure screenshots, traces) lands in test-results-linux/.
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: npm run test:e2e:linux -- <spec>... [playwright test options]" >&2
  exit 1
fi

root=$(git rev-parse --show-toplevel)
cd "$root"

version=$(node -p "require('./package.json').devDependencies['@playwright/test']")
image="mcr.microsoft.com/playwright:v${version}-noble"

# A client newer than the daemon (colima) refuses to talk to it: use the API version the daemon names
if [ -z "${DOCKER_API_VERSION:-}" ]; then
  if ! probe=$(docker version 2>&1); then
    max=$(printf '%s\n' "$probe" | sed -n 's/.*Maximum supported API version is \([0-9.]*\).*/\1/p')
    if [ -z "$max" ]; then
      printf '%s\n' "$probe" >&2
      echo "Docker is not reachable: start it (Docker Desktop, or colima start) and run this again." >&2
      exit 1
    fi
    export DOCKER_API_VERSION=$max
  fi
fi

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Note: uncommitted changes are not run; this runs HEAD $(git rev-parse --short HEAD)." >&2
fi

out="$root/test-results-linux"
rm -rf "$out"
mkdir -p "$out"

# The image's bundled browser is not the one the fixture launches: install chromium. The npm cache and
# the browsers stay in named volumes, so a second run skips those downloads.
git archive HEAD | docker run -i --rm --ipc=host \
  -v mpm-e2e-linux-npm:/root/.npm \
  -v mpm-e2e-linux-browsers:/ms-playwright \
  -v "$out:/out" \
  "$image" bash -c '
    set -euo pipefail
    mkdir /work && tar -x -C /work && cd /work
    HUSKY=0 npm ci --no-audit --no-fund --loglevel=error
    apt-get update -qq && apt-get install -y -qq fonts-dejavu-core >/dev/null
    npx playwright install chromium
    CI=true npx playwright test --retries=0 --reporter=list --output=/out "$@"
  ' bash "$@"
