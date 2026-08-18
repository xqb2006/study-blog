# CMS Public Blog Verification Checklist

Use this checklist after CMS changes that should appear on the Public Blog.

## Runtime Sync Checks

Use for site profile fields: avatar, site name, description, author, and social links.

1. Save the field in `站点装扮 / 身份资料` or `站点装扮 / 社交入口`.
2. Confirm the CMS save message says Runtime Sync updated.
3. Request `https://your-site.pages.dev/runtime/site-settings.json` and confirm the changed value is present.
4. Confirm the response has `Cache-Control: no-store` or equivalent no-cache behavior.
5. Open `/` and `/about`; verify the avatar/profile data matches the CMS value without waiting for a full build.
6. Navigate between pages and confirm the old avatar/profile does not reappear after Astro page transitions.

Failure routing:

- CMS value missing from `runtime/site-settings.json`: CMS save or Runtime Sync write failed.
- Runtime JSON correct but browser page stale: Public Blog runtime script or cache behavior failed.
- Only one page stale: that page is missing runtime profile markers or shared HomeInfo rendering.

## Build Sync Checks

Use for posts, navigation, taxonomy, friends, announcements, BGM, SEO, and other static-output settings.

1. Save a representative CMS change.
2. Open `发布同步` and confirm state becomes running or queued.
3. Wait for success, or inspect the log if it fails.
4. Confirm the relevant Public Blog page changed after success.

Required page smoke set:

- `/`
- `/about`
- `/posts`
- `/categories`
- `/tags`
- `/friends`
- One representative `/post/.../` detail page

Failure routing:

- CMS save failed: fix the CMS form/API validation path.
- Saved but no running/queued Build Sync: check CMS API build trigger.
- Build Sync failed: inspect `.cache/cms/rebuild-blog.log`.
- Build Sync succeeded but page stale: check static output, nginx cache, or Public Blog rendering.

