import '@testing-library/jest-dom/vitest';

// jsdom 에 없는 ClipboardEvent — ProseMirror pasteHTML 이 이벤트 객체만 만들면 된다
if (typeof globalThis.ClipboardEvent === 'undefined') {
  class ClipboardEventShim extends Event {
    clipboardData: DataTransfer | null = null;
  }
  (globalThis as unknown as { ClipboardEvent: typeof Event }).ClipboardEvent = ClipboardEventShim;
}
