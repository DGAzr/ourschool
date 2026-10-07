#!/usr/bin/env bash
# Check the built image: Vite's development server does not exercise nginx.
set -euo pipefail

image=${1:?Usage: check_frontend_image.sh IMAGE}
container=$(docker run --rm -d --add-host backend:127.0.0.1 "$image")
trap 'docker rm -f "$container" >/dev/null' EXIT

for attempt in {1..30}; do
    if docker exec "$container" wget -q -O /dev/null http://127.0.0.1/; then
        break
    fi
    if [[ "$attempt" == 30 ]]; then
        docker logs "$container"
        exit 1
    fi
    sleep 1
done

worker=$(docker exec "$container" find /usr/share/nginx/html/assets \
    -maxdepth 1 -name 'pdf.worker*.mjs')
if [[ -z "$worker" || "$worker" == *$'\n'* ]]; then
    echo 'Expected exactly one built PDF.js module worker.' >&2
    exit 1
fi

worker_url="http://127.0.0.1${worker#/usr/share/nginx/html}"
response=$(docker exec "$container" wget -S -O /dev/null "$worker_url" 2>&1)
if ! grep -Eiq 'Content-Type: (application|text)/javascript' <<<"$response"; then
    echo "$response" >&2
    echo 'PDF.js module worker must be served as JavaScript.' >&2
    exit 1
fi

# A missing worker must not silently return the SPA's HTML with HTTP 200.
response=$(docker exec "$container" wget -S -O /dev/null \
    http://127.0.0.1/assets/pdf.worker-missing.mjs 2>&1 || true)
if ! grep -Eq 'HTTP/1\.[01] 404' <<<"$response"; then
    echo "$response" >&2
    echo 'Missing module workers must return HTTP 404.' >&2
    exit 1
fi

echo 'Production PDF.js worker MIME type and missing-file handling passed.'
