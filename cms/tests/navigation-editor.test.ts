import assert from 'node:assert/strict';
import {
  addNavigationChild,
  addNavigationItem,
  createEmptyNavigationItem,
  moveNavigationItem,
  normalizeNavigation,
  parseNavigationJson,
  removeNavigationItem,
  updateNavigationItem,
} from '../src/lib/navigation-editor';
import type { SiteNavigationItem } from '../src/types';

const navigation: SiteNavigationItem[] = [
  { name: '首页', path: '/', icon: 'ri:home-heart-fill' },
  {
    name: '文章',
    icon: 'ri:quill-pen-ai-fill',
    children: [
      { name: '分类', path: '/categories', icon: 'ri:grid-fill' },
      { name: '标签', path: '/tags', icon: 'fa6-solid:tags' },
    ],
  },
];

assert.deepEqual(createEmptyNavigationItem(), {
  name: '新菜单',
  path: '/',
  icon: 'ri:links-line',
});

assert.deepEqual(addNavigationItem(navigation, { name: '关于', path: '/about' }).map((item) => item.name), ['首页', '文章', '关于']);
assert.deepEqual(addNavigationChild(navigation, 1, { name: '归档', path: '/archives' })[1]?.children?.map((item) => item.name), ['分类', '标签', '归档']);
assert.deepEqual(updateNavigationItem(navigation, [1, 0], { name: '全部分类' })[1]?.children?.[0], {
  name: '全部分类',
  path: '/categories',
  icon: 'ri:grid-fill',
});
assert.deepEqual(removeNavigationItem(navigation, [1, 1])[1]?.children?.map((item) => item.name), ['分类']);
assert.deepEqual(moveNavigationItem(navigation, [1, 1], -1)[1]?.children?.map((item) => item.name), ['标签', '分类']);
assert.deepEqual(moveNavigationItem(navigation, [0], 1).map((item) => item.name), ['文章', '首页']);

assert.deepEqual(
  normalizeNavigation([
    { name: ' 首页 ', nameKey: ' nav.home ', path: ' / ', icon: ' ri:home-heart-fill ', children: [] },
    { name: '空字段', path: '', icon: '', children: [{ name: ' 子项 ', path: ' /child ', icon: '' }] },
  ]),
  [
    { name: '首页', nameKey: 'nav.home', path: '/', icon: 'ri:home-heart-fill' },
    { name: '空字段', children: [{ name: '子项', path: '/child' }] },
  ],
);

assert.deepEqual(parseNavigationJson(JSON.stringify(navigation)).navigation, navigation);
assert.equal(parseNavigationJson('{"name":"bad"}').error, '导航必须是数组');
assert.equal(parseNavigationJson('[{"path":"/missing-name"}]').error, '第 1 项缺少菜单名称');
