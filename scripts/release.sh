#!/bin/bash
# Release script: build, tag, create GitHub release
# Usage: ./scripts/release.sh v2.1.0 "Release title"
# Requires GITHUB_TOKEN environment variable

set -e

VERSION="${1:?Usage: $0 <version> [title]}"
TITLE="${2:-$VERSION}"
REPO="wresource/unmi_web"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd "$PROJECT_DIR"

# Check token
if [ -z "$GITHUB_TOKEN" ]; then
  # Try loading from ecosystem.config.cjs
  GITHUB_TOKEN=$(node -e "try{const c=require('./ecosystem.config.cjs');console.log(c.apps[0].env.GITHUB_TOKEN||'')}catch{}" 2>/dev/null)
fi

if [ -z "$GITHUB_TOKEN" ]; then
  echo "ERROR: GITHUB_TOKEN not set. Set it as environment variable."
  exit 1
fi

echo "=== Building release $VERSION ==="

# Build production
npm run build

# Create release archive
ARCHIVE="unmi-web-${VERSION}.tar.gz"
tar czf "$ARCHIVE" \
  --exclude='node_modules' \
  --exclude='.nuxt' \
  --exclude='data' \
  --exclude='.git' \
  --exclude='ecosystem.config.cjs' \
  --exclude='.claude' \
  --exclude='*.md' \
  --exclude='conversation.md' \
  --exclude='reqiured.md' \
  --exclude='show.md' \
  .output/ \
  package.json \
  package-lock.json \
  ecosystem.config.example.cjs \
  nuxt.config.ts \
  README.md \
  LICENSE \
  CHANGELOG.md \
  scripts/

echo "Archive created: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# Commit and tag
git add -A
git diff --cached --quiet || git commit -m "release: $VERSION"
git tag -a "$VERSION" -m "$TITLE"
git push origin master --tags

# Read changelog for this version
BODY=$(python3 -c "
import re
with open('CHANGELOG.md') as f:
    content = f.read()
# Extract the section for this version
pattern = r'## $VERSION.*?\n(.*?)(?=\n## v|$)'
match = re.search(pattern, content, re.DOTALL)
if match:
    print(match.group(1).strip())
else:
    print('Release $VERSION')
" 2>/dev/null || echo "Release $VERSION")

echo ""
echo "=== Creating GitHub Release ==="

# Create release
RELEASE_RESPONSE=$(curl -s -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/$REPO/releases" \
  -d "$(python3 -c "
import json
print(json.dumps({
    'tag_name': '$VERSION',
    'name': '$TITLE',
    'body': '''$BODY''',
    'draft': False,
    'prerelease': False,
}))
")")

RELEASE_ID=$(echo "$RELEASE_RESPONSE" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
UPLOAD_URL=$(echo "$RELEASE_RESPONSE" | python3 -c "import sys,json;print(json.load(sys.stdin).get('upload_url','').split('{')[0])" 2>/dev/null)

if [ -z "$RELEASE_ID" ] || [ "$RELEASE_ID" = "" ]; then
  echo "ERROR: Failed to create release"
  echo "$RELEASE_RESPONSE"
  exit 1
fi

echo "Release created: ID=$RELEASE_ID"

# Upload archive
echo "Uploading $ARCHIVE..."
curl -s -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/gzip" \
  "${UPLOAD_URL}?name=${ARCHIVE}" \
  --data-binary "@$ARCHIVE" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'Uploaded: {d.get(\"name\",\"\")} ({d.get(\"size\",0)} bytes)')" 2>/dev/null

# Cleanup
rm -f "$ARCHIVE"

echo ""
echo "=== Release $VERSION published ==="
echo "https://github.com/$REPO/releases/tag/$VERSION"
