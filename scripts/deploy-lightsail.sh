#!/usr/bin/env bash
set -euo pipefail

sha=${1:?Missing tested commit SHA}
archive=${2:?Missing frontend ZIP}
repo=/home/ubuntu/chat-playground
webroot=/var/www/chatplayground

cd "$repo"
stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT

# Validate the frontend before updating the running application.
python3 -m zipfile -e "$archive" "$stage"
test -s "$stage/index.html"

git checkout --detach "$sha"
backend/.venv/bin/python -m pip install -e ./backend
sudo -n systemctl restart chatplayground.service

# Wait for FastAPI to report healthy through the production Nginx route.
healthy=false
for attempt in {1..15}; do
  if curl --fail --silent --show-error --max-time 5 \
    --resolve chat.maitools.space:443:127.0.0.1 \
    https://chat.maitools.space/api/v1/health |
    python3 -c 'import json, sys; sys.exit(json.load(sys.stdin).get("status") != "ok")'
  then
    healthy=true
    break
  fi
  sleep 2
done

if [[ "$healthy" != true ]]; then
  echo "Backend health check failed after restart; frontend was not published." >&2
  exit 1
fi

# Publish assets first so the new index only references files already on disk.
find "$stage" -mindepth 1 -maxdepth 1 ! -name index.html \
  -exec cp -R --no-preserve=mode -- {} "$webroot/" \;

install -m 644 "$stage/index.html" "$webroot/.index-${sha}.tmp"
mv -f "$webroot/.index-${sha}.tmp" "$webroot/index.html"

echo "Deployed $sha"
