import type { EditorState } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';

// 표 안에서는 고른 글자가 없어도 툴바를 띄운다 — 방금 넣은 빈 표는 고를 글자가 없어서,
// 이 예외가 없으면 행·열을 고치거나 표를 지울 방법이 없다.
const shouldShowBubbleMenu = ({ editor, state }: { editor: Editor; state: EditorState }) =>
    !editor.isActive('image') &&
    !editor.isActive('videoBlock') &&
    (!state.selection.empty || editor.isActive('table'));

export { shouldShowBubbleMenu };
