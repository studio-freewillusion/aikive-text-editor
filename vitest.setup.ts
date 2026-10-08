import '@testing-library/jest-dom/vitest';

// jsdom 에 없는 ClipboardEvent — ProseMirror pasteHTML 이 이벤트 객체만 만들면 된다
if (typeof globalThis.ClipboardEvent === 'undefined') {
  class ClipboardEventShim extends Event {
    clipboardData: DataTransfer | null = null;
  }
  (globalThis as unknown as { ClipboardEvent: typeof Event }).ClipboardEvent = ClipboardEventShim;
}

// jsdom Range 에 화면 좌표 함수가 없어 ProseMirror 의 스크롤 계산이 터진다
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}
