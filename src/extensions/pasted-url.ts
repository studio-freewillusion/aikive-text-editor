import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface PastedUrlRange {
  from: number;
  to: number;
  url: string;
}

export interface PastedUrlStorage {
  onPaste: ((range: PastedUrlRange) => void) | null;
}

const SINGLE_URL = /^https?:\/\/\S+$/i;

// 붙여넣기는 평소대로 두고 주소 하나만 붙였을 때 들어간 자리만 알린다 — 플레이어로 바꿀지는 에디터 컴포넌트의 창이 묻는다
export const PastedUrl = Extension.create<Record<string, never>, PastedUrlStorage>({
  name: 'pastedUrl',
  addStorage() {
    return { onPaste: null };
  },
  addProseMirrorPlugins() {
    const { editor, storage } = this;
    return [
      new Plugin({
        key: new PluginKey('pastedUrl'),
        props: {
          handlePaste: (view, event) => {
            const raw = event.clipboardData?.getData('text/plain') ?? '';
            const url = raw.trim();
            if (!SINGLE_URL.test(url)) return false;
            // false 를 돌려주면 ProseMirror 가 같은 흐름에서 붙여넣기를 반영하므로 그 뒤에 자리를 잰다
            queueMicrotask(() => {
              if (editor.isDestroyed) return;
              const { selection, doc } = editor.state;
              const to = selection.to;
              const from = to - url.length;
              // 코드 블록 안의 주소는 글자로 쓰려는 것이다
              if (!selection.empty || selection.$from.parent.type.spec.code || from < 0 || doc.textBetween(from, to) !== url) return;
              storage.onPaste?.({ from, to, url });
            });
            if (raw === url) return false;
            // 한 줄을 통째로 복사하면 끝 줄바꿈이 붙어 문단이 하나 더 생긴다 — 자른 주소로 다시 붙여넣어 평소 붙여넣기 처리(링크 등)를 그대로 탄다
            view.pasteText(url, new Event('paste') as ClipboardEvent);
            return true;
          },
        },
      }),
    ];
  },
});
