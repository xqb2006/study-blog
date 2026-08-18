export interface EditorActionStateInput {
  isSaving: boolean;
  isRebuilding: boolean;
  hasUnsavedChanges: boolean;
}

export interface EditorActionState {
  saveDisabled: boolean;
  saveAndBuildDisabled: boolean;
  saveLabel: string;
  saveAndBuildLabel: string;
  saveAndBuildIcon: string;
}

export function getEditorActionState({
  isSaving,
  isRebuilding,
  hasUnsavedChanges,
}: EditorActionStateInput): EditorActionState {
  return {
    saveDisabled: isSaving || isRebuilding || !hasUnsavedChanges,
    saveAndBuildDisabled: isSaving || isRebuilding,
    saveLabel: isSaving ? '保存中...' : '保存',
    saveAndBuildLabel: isSaving ? '保存中...' : isRebuilding ? '同步中...' : '保存并同步',
    saveAndBuildIcon: isSaving || isRebuilding ? 'ri:loader-4-line' : 'ri:rocket-line',
  };
}
