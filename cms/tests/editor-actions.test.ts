import assert from 'node:assert/strict';
import { getEditorActionState } from '../src/lib/editor-actions';

assert.deepEqual(
  getEditorActionState({
    isSaving: false,
    isRebuilding: false,
    hasUnsavedChanges: true,
  }),
  {
    saveDisabled: false,
    saveAndBuildDisabled: false,
    saveLabel: '保存',
    saveAndBuildLabel: '保存并同步',
    saveAndBuildIcon: 'ri:rocket-line',
  },
);

assert.equal(
  getEditorActionState({
    isSaving: false,
    isRebuilding: false,
    hasUnsavedChanges: false,
  }).saveDisabled,
  true,
);

assert.equal(
  getEditorActionState({
    isSaving: false,
    isRebuilding: false,
    hasUnsavedChanges: false,
  }).saveAndBuildDisabled,
  false,
);

assert.deepEqual(
  getEditorActionState({
    isSaving: true,
    isRebuilding: false,
    hasUnsavedChanges: true,
  }),
  {
    saveDisabled: true,
    saveAndBuildDisabled: true,
    saveLabel: '保存中...',
    saveAndBuildLabel: '保存中...',
    saveAndBuildIcon: 'ri:loader-4-line',
  },
);

assert.deepEqual(
  getEditorActionState({
    isSaving: false,
    isRebuilding: true,
    hasUnsavedChanges: true,
  }),
  {
    saveDisabled: true,
    saveAndBuildDisabled: true,
    saveLabel: '保存',
    saveAndBuildLabel: '同步中...',
    saveAndBuildIcon: 'ri:loader-4-line',
  },
);
