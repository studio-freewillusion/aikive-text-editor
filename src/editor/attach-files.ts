import type { Transaction } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import type { NoticeKind } from './types';

export type Notice = (message: string, kind: NoticeKind) => void;
export interface FileDeps {
  upload?: (file: File) => Promise<string>;
  notice: Notice;
}

export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// 새 영상 파일은 받지 않는다 — 영상은 링크로만 넣고, 이미 들어 있는 영상 블록은 그대로 둔다
export function canAttach(file: File, notice: Notice): boolean {
  if (file.type.startsWith('video/')) {
    notice('영상 파일은 첨부할 수 없습니다.', 'info');
    return false;
  }
  if (!IMAGE_MIME_TYPES.includes(file.type)) {
    notice('지원하지 않는 파일 형식입니다.', 'info');
    return false;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    notice('이미지 파일은 10MB 이하의 파일만 등록이 가능합니다.', 'info');
    return false;
  }
  return true;
}

export async function attachFiles(editor: Editor, files: File[], pos: number, deps: FileDeps): Promise<void> {
  if (!deps.upload) return;
  const shown = new Set<string>();
  const noticeOnce: Notice = (message, kind) => {
    if (shown.has(message)) return;
    shown.add(message);
    deps.notice(message, kind);
  };
  const accepted = files.filter((file) => canAttach(file, noticeOnce));
  let at = pos;
  // 올리는 동안 사용자가 고친 내용만큼 넣을 자리를 옮긴다 — 안 옮기면 엉뚱한 곳에 들어가거나 범위를 벗어나 남은 파일이 빠진다
  const follow = ({ transaction }: { transaction: Transaction }) => {
    at = transaction.mapping.map(at);
  };
  editor.on('transaction', follow);
  let inserted = 0;
  try {
    for (const file of accepted) {
      let url: string;
      try {
        url = await deps.upload(file);
      } catch {
        deps.notice(`${file.name} 업로드에 실패했습니다. 다시 시도해 주세요.`, 'error');
        continue;
      }
      if (editor.isDestroyed) return;
      at = Math.min(at, editor.state.doc.content.size);
      editor.chain().focus().insertContentAt(at, { type: 'image', attrs: { src: url } }).run();
      at = editor.state.selection.to;
      inserted += 1;
    }
  } finally {
    editor.off('transaction', follow);
  }
  // 이미지 뒤에서 바로 이어 쓰도록 새 줄로 옮긴다(기존 에디터와 같은 동작)
  if (inserted > 0 && !editor.isDestroyed) editor.chain().focus(at).enter().run();
}
