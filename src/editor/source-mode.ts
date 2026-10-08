import type { Editor } from '@tiptap/react';
import { normalizeSourceHTML } from '../extensions';

export const SOURCE_HTML_ERROR_MESSAGE =
  'HTML 내용을 확인해 주세요. 현재 문서는 에디터 스키마에 맞는 HTML만 지원합니다.\n\n' +
  '현재 비교적 안정적으로 지원하는 태그 예시: p, br, strong, em, s, a, h1~h6, ul, ol, li, blockquote, code, pre, hr, table, tr, th, td, img, iframe';

const isRecoverableTableSourceError = (error: unknown) => {
  if (!(error instanceof Error) || !error.message.includes('Invalid HTML content')) return false;
  const cause = error.cause;
  if (!(cause instanceof Error)) return false;
  return ['<tbody', '<thead', '<tfoot', '<colgroup', '<col'].some((fragment) => cause.message.includes(fragment));
};

// 스키마에 맞지 않는 HTML 이면 던진다 — 쓰는 쪽은 HTML 모드를 유지하고 안내한다
export function applySourceContent(editor: Editor, html: string): void {
  const normalized = normalizeSourceHTML(html);
  try {
    editor.commands.setContent(normalized, { emitUpdate: false, errorOnInvalidContent: true });
  } catch (error) {
    if (!isRecoverableTableSourceError(error)) throw error;
    // 브라우저 파서가 표 아래에 tbody·colgroup 을 다시 넣어 실패한 경우만 느슨하게 한 번 더 넣는다
    editor.commands.setContent(normalized, { emitUpdate: false, errorOnInvalidContent: false });
  }
}
