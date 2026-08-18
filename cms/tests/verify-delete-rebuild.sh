#!/bin/sh
set -eu

cd /opt/blog/astro-koharu

if [ "${1:-}" != "" ]; then
  SLUG="$1"
else
  SLUG="cms-auto-rebuild-verify-$(date +%s)"
fi

echo "SLUG=$SLUG"

rm -f \
  "src/content/blog/tools/$SLUG.md" \
  "src/content/blog/en/tools/$SLUG.md" \
  "src/content/blog/ja/tools/$SLUG.md"

mkdir -p src/content/blog/tools src/content/blog/en/tools src/content/blog/ja/tools

cat > "src/content/blog/tools/$SLUG.md" <<EOF
---
link: $SLUG
title: CMS auto rebuild verify zh
date: 2026-06-20 12:00:00
updated: 2026-06-20 12:00:00
categories:
  - [工具]
tags: [cms-test]
---

Temporary CMS auto rebuild verification post.
EOF

cat > "src/content/blog/en/tools/$SLUG.md" <<EOF
---
link: $SLUG
title: CMS auto rebuild verify en
date: 2026-06-20 12:00:00
updated: 2026-06-20 12:00:00
categories:
  - [工具]
tags: [cms-test]
---

Temporary CMS auto rebuild verification post.
EOF

cat > "src/content/blog/ja/tools/$SLUG.md" <<EOF
---
link: $SLUG
title: CMS auto rebuild verify ja
date: 2026-06-20 12:00:00
updated: 2026-06-20 12:00:00
categories:
  - [工具]
tags: [cms-test]
---

Temporary CMS auto rebuild verification post.
EOF

echo '--- manual prebuild with temp post ---'
docker compose --env-file ./.env -f docker/docker-compose.yml up -d --build >/tmp/cms-auto-rebuild-prebuild.log 2>&1

echo '--- verify pages exist before delete ---'
for p in "/post/$SLUG/" "/en/post/$SLUG/" "/ja/post/$SLUG/"; do
  code=$(curl -sS -o /tmp/page.html -w '%{http_code}' "http://127.0.0.1:4321$p")
  echo "before $p $code"
  test "$code" = "200"
done

echo '--- cms delete triggers async rebuild ---'
DELETE_JSON=$(curl -sS \
  -H 'Content-Type: application/json' \
  -X POST \
  http://127.0.0.1:8082/api/cms/delete \
  --data "{\"postId\":\"tools/$SLUG.md\"}")
echo "$DELETE_JSON"
echo "$DELETE_JSON" | grep '"deletedPostIds"' >/dev/null
echo "$DELETE_JSON" | grep "en/tools/$SLUG.md" >/dev/null
echo "$DELETE_JSON" | grep "ja/tools/$SLUG.md" >/dev/null

for f in "tools/$SLUG.md" "en/tools/$SLUG.md" "ja/tools/$SLUG.md"; do
  test ! -f "src/content/blog/$f"
done

echo '--- wait for automatic rebuild to finish ---'
for i in $(seq 1 240); do
  code=$(curl -sS -o /tmp/page.html -w '%{http_code}' "http://127.0.0.1:4321/post/$SLUG/" || true)
  if [ "$code" = "404" ]; then
    echo "rebuild-observed-after=${i}s"
    break
  fi
  sleep 1
  if [ "$i" = "240" ]; then
    echo "timeout waiting for 404, last=$code" >&2
    exit 1
  fi
done

echo '--- verify all locales gone after auto rebuild ---'
for p in "/post/$SLUG/" "/en/post/$SLUG/" "/ja/post/$SLUG/"; do
  code=$(curl -sS -o /tmp/page.html -w '%{http_code}' "http://127.0.0.1:4321$p")
  echo "after $p $code"
  test "$code" = "404"
done
