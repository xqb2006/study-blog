# Store public image references in blog content

Blog configuration and post frontmatter will store public image references such as `/img/...` or `https://...`, not storage-provider internals like MinIO bucket names or object keys. This keeps the Public Blog static, fast, and provider-agnostic while allowing the CMS to add gallery sources such as local media, GitHub-hosted images, or MinIO later.
