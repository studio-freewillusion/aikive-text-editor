import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

type Meta = { add: { id: string; pos: number } } | { remove: string } | { move: { ids: string[]; pos: number } };

export interface UploadPlaceholderStorage {
  pending: number;
  onChange: ((uploading: boolean) => void) | null;
}

export const uploadPlaceholderKey = new PluginKey<DecorationSet>('uploadPlaceholder');

const placeholderElement = () => {
  const el = document.createElement('div');
  el.className = 'aikive-upload-placeholder';
  el.setAttribute('role', 'status');
  el.contentEditable = 'false';
  el.textContent = '이미지 올리는 중';
  return el;
};

export const UploadPlaceholder = Extension.create<Record<string, never>, UploadPlaceholderStorage>({
  name: 'uploadPlaceholder',
  addStorage() {
    return { pending: 0, onChange: null };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: uploadPlaceholderKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            let next = set.map(tr.mapping, tr.doc);
            const meta = tr.getMeta(uploadPlaceholderKey) as Meta | undefined;
            // side 1: 그 자리에 글을 쓰면 자리 표시가 글 뒤로 밀린다(예전 넣을 위치 따라가기와 같음)
            if (meta && 'add' in meta) {
              next = next.add(tr.doc, [
                Decoration.widget(meta.add.pos, placeholderElement, { id: meta.add.id, side: 1 }),
              ]);
            } else if (meta && 'remove' in meta) {
              next = next.remove(next.find(undefined, undefined, (spec) => spec.id === meta.remove));
            } else if (meta && 'move' in meta) {
              const { ids, pos } = meta.move;
              next = next.remove(next.find(undefined, undefined, (spec) => ids.includes(spec.id)));
              next = next.add(
                tr.doc,
                ids.map((id) => Decoration.widget(pos, placeholderElement, { id, side: 1 })),
              );
            }
            return next;
          },
        },
        props: {
          decorations: (state) => uploadPlaceholderKey.getState(state),
        },
      }),
    ];
  },
});

export const findUploadPlaceholder = (state: EditorState, id: string): number | null =>
  uploadPlaceholderKey.getState(state)?.find(undefined, undefined, (spec) => spec.id === id)[0]?.from ?? null;

const storageOf = (editor: { storage: unknown }) =>
  (editor.storage as { uploadPlaceholder?: UploadPlaceholderStorage }).uploadPlaceholder;

export const uploadPending = (editor: { storage: unknown }): number => storageOf(editor)?.pending ?? 0;

export const changeUploadPending = (editor: { storage: unknown }, delta: number): void => {
  const storage = storageOf(editor);
  if (!storage) return;
  const before = storage.pending > 0;
  storage.pending += delta;
  if (before !== storage.pending > 0) storage.onChange?.(storage.pending > 0);
};
