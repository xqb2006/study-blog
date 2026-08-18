import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { buildStatusHandler } from '../src/api/build';
import { listMediaHandler } from '../src/api/media';
import { getSiteSettingsHandler, saveSiteSettingsHandler } from '../src/api/site-settings';

type AppVariables = {
  projectRoot: string;
};

function createTestApp(projectRoot: string) {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('projectRoot', projectRoot);
    await next();
  });
  return app;
}

async function runSiteSettingsRoundTrip() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-settings-'));
  const configPath = path.join(projectRoot, 'config', 'site.yaml');

  try {
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(
      configPath,
      [
        'site:',
        '  title: Old title',
        '  name: Old name',
        '  author: Old author',
        '  description: Old description',
        '  avatar: /img/avatar.webp',
        '  showLogo: true',
        '  startYear: 2024',
        '  timezone: Asia/Shanghai',
        '  keywords:',
        '    - old',
        'social:',
        '  github:',
        '    url: https://github.com/example',
        '    icon: ri:github-fill',
        'navigation:',
        '  - name: 首页',
        '    path: /',
        '    icon: ri:home-heart-fill',
        'categoryMap:',
        '  随笔: life',
        '  笔记: note',
        'featuredCategories:',
        '  - link: life',
        '    label: 随笔',
        '    image: /img/cover/2.webp',
        '    description: 生活记录',
        'featuredSeries:',
        '  - slug: weekly',
        '    categoryName: 周刊',
        '    label: 周刊',
        '    fullName: 我的周刊',
        '    description: 每周记录',
        '    cover: /img/weekly_header.webp',
        '    enabled: true',
        '    icon: ri:newspaper-line',
        '    highlightOnHome: true',
        '    links:',
        '      rss: /rss.xml',
        'friends:',
        '  intro:',
        '    title: 友情链接',
        '    subtitle: 欢迎交换友链',
        '    applyTitle: 申请友链',
        '    applyDesc: 请留言',
        '    exampleYaml: |',
        '      - site: 你的博客',
        '        url: https://example.com',
        '        owner: 你',
        '        desc: 简介',
        '        image: https://example.com/avatar.png',
        '  data:',
        '    - site: Old Friend',
        '      url: https://old.example.com',
        '      owner: Old Owner',
        '      desc: Old Desc',
        '      image: https://old.example.com/avatar.png',
        '      color: \"#abcdef\"',
        'announcements:',
        '  - id: old-notice',
        '    title: Old Notice',
        '    content: Old content',
        '    type: info',
        '    priority: 1',
        '    publishDate: \"2026-06-20\"',
        'comment:',
        '  provider: twikoo',
        '  twikoo:',
        '    envId: https://twikoo.example.com',
        '    region: ap-shanghai',
        '    path: location.pathname',
        '    lang: zh-CN',
        'analytics:',
        '  umami:',
        '    enabled: true',
        '    id: old-umami-id',
        '    endpoint: https://stats.example.com',
        '    statistics_display:',
        '      token: old-token',
        '      article_page_views: true',
        '      footer_site_stats: false',
        'seo:',
        '  robots:',
        '    host: true',
        '    policy:',
        '      - userAgent: \"*\"',
        '        allow:',
        '          - /',
        '        disallow:',
        '          - /api/',
        'bgm:',
        '  enabled: true',
        '  metingApi: https://music-api.example.com/',
        '  audio:',
        '    - title: Old Playlist',
        '      list:',
        '        - https://music.163.com/playlist?id=1',
        'content:',
        '  enableCodeCopy: true',
        '  enableMath: true',
      ].join('\n'),
      'utf-8',
    );

    const app = createTestApp(projectRoot);
    app.get('/api/cms/site-settings', getSiteSettingsHandler);
    app.post('/api/cms/site-settings', saveSiteSettingsHandler);

    const getResponse = await app.request('/api/cms/site-settings');
    const getBody = await getResponse.json();

    assert.equal(getResponse.status, 200);
    assert.equal(getBody.settings.site.title, 'Old title');
    assert.equal(getBody.settings.social.github.url, 'https://github.com/example');
    assert.equal(getBody.settings.categoryMap['随笔'], 'life');
    assert.equal(getBody.settings.featuredCategories[0].label, '随笔');
    assert.equal(getBody.settings.featuredSeries[0].slug, 'weekly');
    assert.equal(getBody.settings.featuredSeries[0].links.rss, '/rss.xml');
    assert.equal(getBody.settings.friends.intro.title, '友情链接');
    assert.equal(getBody.settings.friends.data[0].site, 'Old Friend');
    assert.equal(getBody.settings.announcements[0].id, 'old-notice');
    assert.equal(getBody.settings.comment.provider, 'twikoo');
    assert.equal(getBody.settings.comment.twikoo.envId, 'https://twikoo.example.com');
    assert.equal(getBody.settings.analytics.umami.id, 'old-umami-id');
    assert.equal(getBody.settings.analytics.umami.statistics_display.token, 'old-token');
    assert.equal(getBody.settings.seo.robots.host, true);
    assert.equal(getBody.settings.seo.robots.policy[0].disallow[0], '/api/');
    assert.equal(getBody.settings.bgm.enabled, true);
    assert.equal(getBody.settings.bgm.audio[0].title, 'Old Playlist');

    const saveResponse = await app.request('/api/cms/site-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site: {
          title: 'New title',
          author: 'New author',
          keywords: ['blog', 'cms'],
        },
        content: {
          enableCodeCopy: false,
          enableMath: true,
        },
        categoryMap: {
          随笔: 'life',
          项目: 'project',
        },
        featuredCategories: [
          {
            link: 'project',
            label: '项目',
            image: '/img/cover/project.webp',
            description: '项目复盘',
          },
        ],
        featuredSeries: [
          {
            slug: 'reading',
            categoryName: '读书',
            label: '书摘',
            fullName: '我的读书笔记',
            description: '阅读记录与读后感',
            cover: '/img/reading.webp',
            enabled: false,
            icon: 'ri:book-read-line',
            highlightOnHome: false,
            links: {
              rss: '/rss.xml',
              github: 'https://github.com/example/reading',
            },
          },
        ],
        friends: {
          intro: {
            title: '我的友链',
            subtitle: '一起互联',
            applyTitle: '申请方式',
            applyDesc: '请留下站点信息',
            exampleYaml: '- site: 示例',
          },
          data: [
            {
              site: 'New Friend',
              url: 'https://new.example.com',
              owner: 'New Owner',
              desc: 'New Desc',
              image: 'https://new.example.com/avatar.png',
              color: '#123456',
            },
          ],
        },
        announcements: [
          {
            id: 'new-notice',
            title: 'New Notice',
            content: 'New content',
            type: 'success',
            priority: 9,
            color: '#00ff88',
            publishDate: '2026-06-21',
            link: {
              url: 'https://blog.example.com',
              text: '查看',
              external: true,
            },
          },
        ],
        comment: {
          provider: 'giscus',
          giscus: {
            repo: 'owner/repo',
            repoId: 'R_kgDO123',
            category: 'Announcements',
            categoryId: 'DIC_kwDO123',
            mapping: 'pathname',
            reactionsEnabled: '1',
            emitMetadata: '0',
            inputPosition: 'top',
            lang: 'zh-CN',
            theme: 'light',
            loading: 'lazy',
          },
        },
        analytics: {
          umami: {
            enabled: false,
            id: 'new-umami-id',
            endpoint: 'https://new-stats.example.com',
            statistics_display: {
              token: 'new-token',
              article_page_views: false,
              footer_site_stats: true,
            },
          },
        },
        seo: {
          robots: {
            host: false,
            policy: [
              {
                userAgent: '*',
                allow: ['/'],
                disallow: ['/private/'],
              },
            ],
          },
        },
        bgm: {
          enabled: false,
          metingApi: 'https://music-api.new.example.com/',
          audio: [
            {
              title: 'New Playlist',
              list: ['https://music.163.com/playlist?id=2', 'https://music.163.com/song?id=3'],
            },
          ],
        },
      }),
    });
    const saveBody = await saveResponse.json();
    const updatedConfig = await readFile(configPath, 'utf-8');

    assert.equal(saveResponse.status, 200);
    assert.equal(saveBody.success, true);
    assert.equal(saveBody.runtimeSync.success, true);
    assert.equal(saveBody.runtimeSync.path, '/runtime/site-settings.json');
    assert.equal(saveBody.buildSync.failed, true);
    assert.match(saveBody.buildSync.message, /Public Blog/);
    assert.match(updatedConfig, /title: New title/);
    assert.match(updatedConfig, /author: New author/);
    assert.match(updatedConfig, /enableCodeCopy: false/);
    assert.match(updatedConfig, /项目: project/);
    assert.match(updatedConfig, /link: project/);
    assert.match(updatedConfig, /slug: reading/);
    assert.equal(saveBody.settings.featuredSeries[0].enabled, false);
    assert.match(updatedConfig, /site: New Friend/);
    assert.match(updatedConfig, /title: New Notice/);
    assert.equal(saveBody.settings.comment.provider, 'giscus');
    assert.match(updatedConfig, /repo: owner\/repo/);
    assert.equal(saveBody.settings.analytics.umami.enabled, false);
    assert.match(updatedConfig, /id: new-umami-id/);
    assert.equal(saveBody.settings.seo.robots.host, false);
    assert.match(updatedConfig, /\/private\//);
    assert.equal(saveBody.settings.bgm.enabled, false);
    assert.match(updatedConfig, /metingApi: https:\/\/music-api\.new\.example\.com\//);
    assert.match(updatedConfig, /title: New Playlist/);
    const runtimeConfig = await readFile(path.join(projectRoot, 'public', 'runtime', 'site-settings.json'), 'utf-8');
    assert.match(runtimeConfig, /New title/);
    assert.match(runtimeConfig, /New author/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function runMediaList() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-media-'));

  try {
    await mkdir(path.join(projectRoot, 'public', 'img', 'cover'), { recursive: true });
    await writeFile(path.join(projectRoot, 'public', 'img', 'avatar.webp'), 'image', 'utf-8');
    await writeFile(path.join(projectRoot, 'public', 'img', 'cover', 'one.png'), 'image', 'utf-8');
    await writeFile(path.join(projectRoot, 'public', 'img', 'notes.txt'), 'not image', 'utf-8');

    const app = createTestApp(projectRoot);
    app.get('/api/cms/media', listMediaHandler);

    const response = await app.request('/api/cms/media');
    const body = await response.json();
    const paths = body.files.map((file: { publicPath: string }) => file.publicPath).sort();

    assert.equal(response.status, 200);
    assert.deepEqual(paths, ['/img/avatar.webp', '/img/cover/one.png']);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function runBuildStatus() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-build-'));

  try {
    await mkdir(path.join(projectRoot, '.cache', 'cms'), { recursive: true });
    await mkdir(path.join(projectRoot, 'dist'), { recursive: true });
    await writeFile(
      path.join(projectRoot, '.cache', 'cms', 'rebuild-blog.log'),
      '[2026-06-20 12:00:00] rebuild start\n[2026-06-20 12:00:03] rebuild complete\n',
      'utf-8',
    );

    const app = createTestApp(projectRoot);
    app.get('/api/cms/build/status', buildStatusHandler);

    const response = await app.request('/api/cms/build/status');
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.isRunning, false);
    assert.equal(body.lastResult, 'success');
    assert.match(body.log, /rebuild complete/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

Promise.all([runSiteSettingsRoundTrip(), runMediaList(), runBuildStatus()]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
