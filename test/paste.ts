import type { Editor } from '@tiptap/core';

// jsdom 에는 ClipboardEvent·DataTransfer 가 없어 clipboardData 를 직접 단다
export function pastePlainText(editor: Editor, text: string): void {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (type: string) => (type === 'text/plain' ? text : ''), types: ['text/plain'], files: [], items: [] },
  });
  editor.view.dom.dispatchEvent(event);
}

// 다른 에디터·웹 페이지에서 복사하면 글자와 HTML 이 함께 온다
export function pasteWithHtml(editor: Editor, text: string, html: string): void {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      getData: (type: string) => (type === 'text/plain' ? text : type === 'text/html' ? html : ''),
      types: ['text/plain', 'text/html'],
      files: [],
      items: [],
    },
  });
  editor.view.dom.dispatchEvent(event);
}
