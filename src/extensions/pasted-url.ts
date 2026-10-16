import { Extension } from '@tiptap/core';
import type { ResolvedPos } from '@tiptap/pm/model';
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

// 에디터끼리 줄째 복사해 붙이면 끝 줄바꿈 때문에 커서가 새 빈 줄에 있다 — 그때는 바로 윗줄 끝을 본다
function urlEnd($pos: ResolvedPos, url: string): number {
  if ($pos.parent.content.size > 0 || $pos.depth === 0) return $pos.pos;
  const index = $pos.index($pos.depth - 1);
  const prev = index > 0 ? $pos.node($pos.depth - 1).child(index - 1) : null;
  return prev?.isTextblock && prev.textContent === url ? $pos.before() - 1 : $pos.pos;
}

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
          // 한 줄을 통째로 복사하면 끝 줄바꿈이 붙어 문단이 하나 더 생긴다 — 글자만 붙일 때 주소 하나면 자른다(HTML 붙여넣기는 그대로)
          transformPastedText: (text, _plain, view) => {
            const url = text.trim();
            if (url === text || !SINGLE_URL.test(url) || view.state.selection.$from.parent.type.spec.code) return text;
            return url;
          },
          handlePaste: (_view, event) => {
            const url = event.clipboardData?.getData('text/plain').trim() ?? '';
            if (!SINGLE_URL.test(url)) return false;
            // false 를 돌려주면 ProseMirror 가 같은 흐름에서 붙여넣기를 반영하므로 그 뒤에 자리를 잰다
            queueMicrotask(() => {
              if (editor.isDestroyed) return;
              const { selection, doc } = editor.state;
              if (!selection.empty) return;
              const to = urlEnd(selection.$from, url);
              const from = to - url.length;
              // 코드 블록 안의 주소는 글자로 쓰려는 것이다
              if (from < 0 || doc.resolve(to).parent.type.spec.code || doc.textBetween(from, to) !== url) return;
              storage.onPaste?.({ from, to, url });
            });
            return false;
          },
        },
      }),
    ];
  },
});
