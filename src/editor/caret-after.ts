import type { Editor } from '@tiptap/core';
import { Selection, TextSelection } from '@tiptap/pm/state';

// 넣거나 고친 블록 바로 뒤에서 이어 쓰게 한다 — 블록이 선택된 채 남으면 다음 입력이 블록을 지운다
export function placeCaretAfterBlock(editor: Editor, pos: number, { newLine }: { newLine: boolean }): void {
  const { state } = editor;
  let $pos = state.doc.resolve(Math.min(pos, state.doc.content.size));
  // 블록 뒤 문단의 첫 자리로 받은 경우 블록 경계로 되돌려 같은 기준으로 판단한다
  if ($pos.parent.isTextblock && $pos.parentOffset === 0 && $pos.depth > 0) $pos = state.doc.resolve($pos.before());
  const { tr } = state;
  const after = $pos.nodeAfter;
  const paragraph = state.schema.nodes.paragraph;
  if (after?.type === paragraph && after.content.size === 0) {
    tr.setSelection(TextSelection.create(tr.doc, $pos.pos + 1));
  } else if (newLine && $pos.parent.canReplaceWith($pos.index(), $pos.index(), paragraph)) {
    tr.insert($pos.pos, paragraph.create()).setSelection(TextSelection.create(tr.doc, $pos.pos + 1));
  } else {
    const next = Selection.findFrom($pos, 1, true);
    if (!next) return;
    tr.setSelection(next);
  }
  editor.view.dispatch(tr.scrollIntoView());
}
