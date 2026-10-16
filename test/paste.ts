import type { Editor } from '@tiptap/core';

// jsdom 에는 ClipboardEvent·DataTransfer 가 없어 clipboardData 를 직접 단다
export function pastePlainText(editor: Editor, text: string): void {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (type: string) => (type === 'text/plain' ? text : ''), types: ['text/plain'], files: [], items: [] },
  });
  editor.view.dom.dispatchEvent(event);
}
