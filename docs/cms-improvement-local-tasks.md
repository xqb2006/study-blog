# CMS Improvement Local Task List

This task list breaks [CMS Improvement PRD](./cms-improvement-prd.md), [CMS Improvement Plan](./cms-improvement-plan.md), [CONTEXT.md](../CONTEXT.md), and the ADRs into independently grabbable local tasks. These are tracer-bullet slices: each task should produce a complete, demoable path rather than a single horizontal layer.

No issue tracker publishing is required for this list.

## Task CMS-001: Rename CMS Primary Navigation

**Blocked by**: None

**Goal**:
Rename the CMS Primary Navigation so the CMS feels like the Blog Operations Workspace for the 个人博客 instead of a generic admin panel.

**In Scope**:

- Primary navigation labels.
- Primary navigation descriptions.
- Page titles and obvious section headings tied to the primary sections.
- Active-tab behavior for all existing sections.

**Acceptance Criteria**:

- [ ] Primary navigation labels are `工作台 / 文章书房 / 素材库 / 分类花园 / 站点装扮 / 运营设置 / 发布同步 / 回收站`.
- [ ] The old labels `仪表盘 / 文章管理 / 媒体库 / 分类标签 / 主题外观 / 插件中心 / 系统设置 / 操作日志` do not appear as primary navigation labels.
- [ ] Every renamed navigation item still opens the correct existing CMS section.
- [ ] Page titles match the new vocabulary where visible to the user.

**Test Method**:

- Run the CMS locally or on the existing service and click every primary navigation item.
- Search the rendered CMS UI for old primary navigation labels.
- Run the existing CMS build/type/lint checks used by the project.

**Not Doing**:

- Do not redesign the content inside each section.
- Do not change tab IDs, API routes, or storage format unless the implementation requires a private compatibility adapter.
- Do not rename Public Blog routes.

## Task CMS-002: Build Real 工作台 Status Data

**Blocked by**: None

**Goal**:
Make 工作台 show only 真实信息 and remove fake trend charts, placeholder analytics, and inferred counters.

**In Scope**:

- 工作台 first viewport.
- Total posts, draft posts, recent updates.
- Current Build Sync status.
- Current Runtime Sync/profile sync status where available.
- Removal of fake trend data and inferred page-view counters.

**Acceptance Criteria**:

- [ ] 工作台 first viewport prioritizes Sync status, build status, total posts, draft posts, recent updates, and quick actions.
- [ ] No fake trend chart is visible.
- [ ] No inferred or decorative page-view counter is visible.
- [ ] Every shown metric comes from repository content, site configuration, runtime sync state, build state, or another real integration.
- [ ] Empty or unavailable real data has a clear empty state instead of fake replacement data.

**Test Method**:

- Load 工作台 with existing content and verify visible counts match CMS list/build APIs.
- Temporarily test an empty or low-content state if feasible and confirm no fake data appears.
- Search the CMS code for removed fake constants and inferred view calculations.

**Not Doing**:

- Do not add external analytics integration in this task.
- Do not implement full Public Blog verification in this task.
- Do not redesign every CMS page.

## Task CMS-003: Wire 工作台 Quick Actions End-to-End

**Blocked by**: CMS-001

**Goal**:
Make 工作台 quick actions real and immediately useful for daily blog operations.

**In Scope**:

- Quick actions: `写新文章 / 上传素材 / 修改装扮 / 发布同步 / 查看博客`.
- Navigation or modal behavior for each action.
- Visible result after each click.

**Acceptance Criteria**:

- [ ] `写新文章` opens the create-post flow.
- [ ] `上传素材` opens 素材库 at the media upload workflow.
- [ ] `修改装扮` opens 站点装扮.
- [ ] `发布同步` opens 发布同步.
- [ ] `查看博客` opens the Public Blog safely in a new tab/window.
- [ ] No quick action is decorative or dead.

**Test Method**:

- Click each quick action in the CMS and verify the resulting view or external page.
- Verify keyboard focus reaches each action.
- Run the existing CMS build/type/lint checks used by the project.

**Not Doing**:

- Do not implement new editor features beyond opening the existing create-post flow.
- Do not add new Public Blog pages.
- Do not change Build Sync internals.

## Task CMS-004: Redesign 发布同步 Around Save vs Public Blog Visibility

**Blocked by**: None

**Goal**:
Make 发布同步 the single trustworthy place to understand Build Sync, Runtime Sync, logs, and whether the Public Blog is current.

**In Scope**:

- 发布同步 page.
- Build status, last result, logs, and dist update time.
- `重新同步` action.
- Clear messaging for saved state vs Public Blog visibility.
- Failure state shown in both 发布同步 and data that 工作台 can consume.

**Acceptance Criteria**:

- [ ] 发布同步 shows running/success/failure/unknown states.
- [ ] 发布同步 exposes logs or a log path for Build Sync.
- [ ] 发布同步 has a `重新同步` action that triggers the existing rebuild/sync path.
- [ ] If a save succeeds but Public Blog sync fails, the CMS can display that distinction.
- [ ] 工作台 can surface the same failure state without duplicating unrelated logic.

**Test Method**:

- Trigger a normal rebuild and confirm the page moves through running to success.
- Simulate or force a failed rebuild and confirm failure state, logs, and `重新同步` are visible.
- Confirm continued editing is not blocked by the failure state.

**Not Doing**:

- Do not implement new deployment infrastructure.
- Do not block editing when sync fails.
- Do not hide raw diagnostic information needed for recovery.

## Task CMS-005: Split 站点装扮 Into Focused Sections

**Blocked by**: CMS-001

**Goal**:
Make 站点装扮 usable by splitting the long settings page into focused editing surfaces.

**In Scope**:

- 站点装扮 layout.
- Sections: `身份资料 / 社交入口 / 导航菜单 / 内容开关`.
- Section navigation and active-section state.
- Save/reload behavior across all four sections.

**Acceptance Criteria**:

- [ ] 站点装扮 shows the four approved sections.
- [ ] Only the active section appears in the main editing area.
- [ ] Saving from any section preserves unrelated settings.
- [ ] Reloading settings restores the correct values in each section.
- [ ] The page no longer feels like one long unstructured form.

**Test Method**:

- Visit each section, edit a representative value, save, reload, and verify persistence.
- Confirm inactive sections are not visually stacked below the active section.
- Run existing site-settings tests if present, and add focused tests for settings normalization if implementation changes it.

**Not Doing**:

- Do not add MinIO integration.
- Do not change Public Blog visual theme.
- Do not move advanced operational integrations into 站点装扮.

## Task CMS-006: Make 身份资料 Image Fields Use Public Image References

**Blocked by**: CMS-005

**Goal**:
Support both 素材库 selection and 外链图片 input for avatar/default share image while preserving ADR 0002.

**In Scope**:

- Avatar/default image fields in 身份资料.
- CMS media picker path output.
- Manual HTTP(S) URL input, including GitHub-hosted image URLs.
- Validation and preview behavior for public image references.

**Acceptance Criteria**:

- [ ] A CMS media asset can be selected and saved as a public site-relative path.
- [ ] A public HTTP(S) URL can be entered manually and saved.
- [ ] GitHub-hosted image URLs are accepted when they are public HTTP(S) references.
- [ ] Saved blog config contains only public paths/URLs, not storage-provider internals.
- [ ] Preview updates for both local media paths and external URLs.

**Test Method**:

- Save avatar using a CMS media asset and verify config/runtime output.
- Save avatar using a public HTTP(S) URL and verify config/runtime output.
- Verify invalid or non-public image references are rejected or clearly marked.
- Run media path and site-settings tests.

**Not Doing**:

- Do not implement MinIO upload or browsing yet.
- Do not store bucket/key/provider metadata in blog config or frontmatter.
- Do not require a full rebuild for safe Runtime Sync fields.

## Task CMS-007: Expand Runtime Sync for Site Profile Changes

**Blocked by**: CMS-006

**Goal**:
Make common site profile changes appear on the Public Blog within 1 second in normal operation without full Build Sync.

**In Scope**:

- Runtime Sync payload for site profile fields.
- CMS save behavior for Runtime Sync fields.
- Public Blog consumption of runtime profile data on required verification surfaces.
- Cache-control and no-store behavior for runtime settings.
- User messaging after Runtime Sync saves.

**Acceptance Criteria**:

- [ ] Avatar changes Runtime Sync to the Public Blog within 1 second in normal operation.
- [ ] Site name/title/description profile changes Runtime Sync where they are visible without requiring a full rebuild.
- [ ] Social/profile data that is safe for runtime update uses Runtime Sync.
- [ ] Runtime Sync responses are not cached across avatar/profile switches.
- [ ] The CMS save message clearly says the Runtime Sync result.

**Test Method**:

- Save avatar/profile changes in CMS and verify Public Blog pages `/` and `/about` update without a full rebuild.
- Use browser DOM checks and network headers to confirm current runtime data and no-store behavior.
- Verify stale page-transition DOM does not retain old profile data.

**Not Doing**:

- Do not Runtime Sync structural navigation, taxonomy, SEO, or post body content.
- Do not remove Build Sync for static-output changes.
- Do not introduce a client-side app shell for the Public Blog.

## Task CMS-008: Apply Build Sync to Static-Content Changes

**Blocked by**: CMS-004

**Goal**:
Ensure static-content changes automatically enter Build Sync and expose their state clearly.

**In Scope**:

- Post create/edit/delete/draft/sticky changes.
- Navigation, taxonomy, friends, announcements, BGM, SEO, and other static-output settings.
- Save messaging for changes that start or queue Build Sync.
- Build queue/running behavior already implied by the existing build lock/pending model.

**Acceptance Criteria**:

- [ ] Representative post changes trigger or queue Build Sync.
- [ ] Representative static settings changes trigger or queue Build Sync.
- [ ] CMS messages distinguish "saved" from "Public Blog updated".
- [ ] 发布同步 shows running/success/failure for these changes.
- [ ] Build Sync target remains 30-90 seconds in normal operation.

**Test Method**:

- Edit a draft/title/category in CMS and confirm Build Sync starts or queues.
- Edit navigation or announcements and confirm Build Sync starts or queues.
- Verify Public Blog pages update after successful Build Sync.
- Inspect build logs/status for queued/running behavior.

**Not Doing**:

- Do not make static-content changes bypass Build Sync.
- Do not block the user from continuing to edit while a build is running.
- Do not add a new CI/CD system.

## Task CMS-009: Make 素材库 Media Availability Immediate

**Blocked by**: None

**Goal**:
Make uploaded media immediately available in the CMS and usable by later image selection workflows.

**In Scope**:

- Media upload success path.
- Media list refresh after upload/delete/restore.
- Selecting newly uploaded media from CMS image fields.
- Clear distinction between Media Availability in CMS and Public Blog visibility after references are used.

**Acceptance Criteria**:

- [ ] Uploaded media appears in 素材库 immediately after upload.
- [ ] Uploaded media can be selected by image fields without restarting CMS.
- [ ] Deleted/restored media updates the list clearly.
- [ ] CMS does not imply that merely uploading media updates Public Blog pages.
- [ ] Media references produced by selection are public paths usable by the Public Blog.

**Test Method**:

- Upload an image, verify it appears immediately, select it in an image field, save, and verify the saved public path.
- Delete and restore media and confirm the UI updates.
- Run media API and media path tests.

**Not Doing**:

- Do not add MinIO.
- Do not optimize image processing beyond existing behavior.
- Do not rebuild the Public Blog on upload alone.

## Task CMS-010: Keep 氛围装饰 Safe and Non-Essential

**Blocked by**: CMS-001

**Goal**:
Preserve Sakura/Koharu atmosphere without letting decorative images break workflows or carry essential information.

**In Scope**:

- Decorative Sakura/anime assets across the CMS shell and panels.
- Missing-image fallback behavior.
- Removal of essential text or workflow instructions from decorative-only components.
- Basic 品牌一致性 pass on CMS shell.

**Acceptance Criteria**:

- [ ] Missing decorative images do not leave visibly broken UI.
- [ ] Decorative assets can hide or degrade gracefully.
- [ ] Essential workflow information remains in text, controls, status, or tables, not only in images.
- [ ] No Live2D, Lottie, or character animation is introduced.
- [ ] CMS visual style remains aligned with the 个人博客 Public Blog identity.

**Test Method**:

- Temporarily break decorative image URLs in a local test and verify graceful fallback.
- Inspect 工作台, 分类花园, and shell/sidebar surfaces.
- Run visual browser checks at desktop and mobile widths.

**Not Doing**:

- Do not implement animated characters.
- Do not add heavy decorative libraries.
- Do not prioritize decoration over management readability.

## Task CMS-011: Cover 桌面优先 Mobile Essentials

**Blocked by**: CMS-003, CMS-004, CMS-005, CMS-009

**Goal**:
Make the essential CMS flows usable on mobile while keeping full management workflows desktop-optimized.

**In Scope**:

- Mobile status viewing on 工作台.
- Mobile access to quick publishing.
- Mobile media upload entry.
- Mobile avatar/basic profile editing.
- Mobile 发布同步 trigger and status.
- Text fit and non-overlap at mobile widths.

**Acceptance Criteria**:

- [ ] Mobile 工作台 shows status and quick actions without overlap.
- [ ] Mobile user can reach quick publishing.
- [ ] Mobile user can reach media upload.
- [ ] Mobile user can edit avatar/basic profile fields.
- [ ] Mobile user can trigger 发布同步 and see status.
- [ ] Complex tables and long-form editing may remain desktop-optimized but must not break mobile layout.

**Test Method**:

- Browser-test mobile viewport for 工作台, 文章书房 entry, 素材库 upload entry, 站点装扮 身份资料, and 发布同步.
- Confirm no text overlaps or unusable clipped controls in essential mobile flows.
- Run desktop regression spot checks after mobile layout changes.

**Not Doing**:

- Do not make every advanced table or bulk-management workflow fully mobile-first.
- Do not redesign the Public Blog mobile theme.
- Do not add a separate mobile app.

## Task CMS-012: Add Public Blog Verification Checklist for CMS Changes

**Blocked by**: CMS-007, CMS-008

**Goal**:
Create a repeatable verification path for proving CMS changes appear correctly on the Public Blog.

**In Scope**:

- Verification checklist or script for required Public Blog pages.
- Runtime Sync checks for profile/avatar changes.
- Build Sync checks for static-content changes.
- Browser-level smoke checks where practical.

**Acceptance Criteria**:

- [ ] Verification covers `/`, `/about`, `/posts`, `/categories`, `/tags`, `/friends`, and one representative post detail page.
- [ ] Runtime Sync verification confirms current profile/avatar data.
- [ ] Build Sync verification confirms static-output changes after successful build.
- [ ] The verification process is documented enough for another agent to run.
- [ ] Failures point to whether the problem is CMS save, Runtime Sync, Build Sync, cache, or Public Blog rendering.

**Test Method**:

- Run the verification process after a Runtime Sync profile change.
- Run the verification process after a Build Sync static-content change.
- Confirm the checklist catches stale avatar/profile or stale static page output.

**Not Doing**:

- Do not create a full end-to-end test suite for every CMS feature.
- Do not require external analytics or third-party services for verification.
- Do not replace manual exploratory QA where visual judgment is still needed.

## Suggested Implementation Order

1. CMS-001: Rename CMS Primary Navigation
2. CMS-004: Redesign 发布同步 Around Save vs Public Blog Visibility
3. CMS-002: Build Real 工作台 Status Data
4. CMS-003: Wire 工作台 Quick Actions End-to-End
5. CMS-005: Split 站点装扮 Into Focused Sections
6. CMS-006: Make 身份资料 Image Fields Use Public Image References
7. CMS-007: Expand Runtime Sync for Site Profile Changes
8. CMS-008: Apply Build Sync to Static-Content Changes
9. CMS-009: Make 素材库 Media Availability Immediate
10. CMS-010: Keep 氛围装饰 Safe and Non-Essential
11. CMS-011: Cover 桌面优先 Mobile Essentials
12. CMS-012: Add Public Blog Verification Checklist for CMS Changes

