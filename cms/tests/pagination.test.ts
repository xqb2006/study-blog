import assert from 'node:assert/strict';
import { getPageWindow } from '../src/lib/pagination';

const items = Array.from({ length: 13 }, (_, index) => `item-${index + 1}`);

const firstPage = getPageWindow(items, 1, 5);
assert.equal(firstPage.page, 1);
assert.equal(firstPage.pageSize, 5);
assert.equal(firstPage.pageCount, 3);
assert.equal(firstPage.start, 1);
assert.equal(firstPage.end, 5);
assert.deepEqual(firstPage.items, ['item-1', 'item-2', 'item-3', 'item-4', 'item-5']);

const lastPage = getPageWindow(items, 99, 5);
assert.equal(lastPage.page, 3);
assert.equal(lastPage.start, 11);
assert.equal(lastPage.end, 13);
assert.deepEqual(lastPage.items, ['item-11', 'item-12', 'item-13']);

const emptyPage = getPageWindow([], 4, 10);
assert.equal(emptyPage.page, 1);
assert.equal(emptyPage.pageCount, 1);
assert.equal(emptyPage.start, 0);
assert.equal(emptyPage.end, 0);
assert.deepEqual(emptyPage.items, []);
