import type { Editor } from '@tiptap/react';
import { normalizeSourceHTML } from '../extensions';

export const SOURCE_HTML_ERROR_MESSAGE = 'HTML 을 적용하지 못했습니다. 내용을 확인해 주세요.';

// 표현할 수 있는 내용은 모두 넣고 나머지는 저장할 때처럼 빠진다 — 엄격 검사는 글자 스타일 span·유튜브까지 거부해 쓰지 않는다
export function applySourceContent(editor: Editor, html: string): void {
  editor.commands.setContent(normalizeSourceHTML(html), { emitUpdate: false, errorOnInvalidContent: false });
}
