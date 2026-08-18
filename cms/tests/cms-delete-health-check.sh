#!/bin/sh
set -eu

cd /opt/blog/astro-koharu

echo '--- cms home local GET ---'
curl -sS -o /tmp/cms-home.html -w 'status=%{http_code} type=%{content_type}\n' http://127.0.0.1:8082/
head -c 120 /tmp/cms-home.html
printf '\n'

echo '--- cms list local GET ---'
curl -sS -o /tmp/cms-list.json -w 'status=%{http_code} type=%{content_type}\n' http://127.0.0.1:8082/api/cms/list
head -c 120 /tmp/cms-list.json
printf '\n'

echo '--- delete invalid extension ---'
curl -sS -o /tmp/cms-delete-invalid.json -w 'status=%{http_code} type=%{content_type}\n' \
  -H 'Content-Type: application/json' \
  -X POST \
  http://127.0.0.1:8082/api/cms/delete \
  --data '{"postId":"bad.txt"}'
cat /tmp/cms-delete-invalid.json
printf '\n'

echo '--- cms container ---'
docker ps --filter name=koharu-cms --format 'name={{.Names}} status={{.Status}} ports={{.Ports}}'
