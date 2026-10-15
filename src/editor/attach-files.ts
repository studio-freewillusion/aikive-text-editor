import type { Editor } from '@tiptap/react';
import { changeUploadPending, findUploadPlaceholder, uploadPlaceholderKey } from '../extensions/upload-placeholder';
import type { NoticeKind } from './types';

export type Notice = (message: string, kind: NoticeKind) => void;
export interface FileDeps {
  upload?: (file: File) => Promise<string>;
  notice: Notice;
}

export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DROPPED_MESSAGE = '올리던 이미지는 넣지 않았습니다. 다시 첨부해 주세요.';
let uploadSeq = 0;

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
  const { upload } = deps;
  if (!upload) return;
  const shown = new Set<string>();
  const noticeOnce: Notice = (message, kind) => {
    if (shown.has(message)) return;
    shown.add(message);
    deps.notice(message, kind);
  };
  const jobs = files.filter((file) => canAttach(file, noticeOnce)).map((file) => ({ file, id: `upload-${++uploadSeq}` }));
  if (!jobs.length) return;
  const at = Math.min(pos, editor.state.doc.content.size);
  // 자리 표시 위치가 곧 넣을 위치다 — 올리는 동안 고친 내용만큼 함께 옮겨지고, 본문이 바뀌어 사라지면 넣지 않는다
  for (const job of jobs) {
    editor.view.dispatch(editor.state.tr.setMeta(uploadPlaceholderKey, { add: { id: job.id, pos: at } }));
  }
  changeUploadPending(editor, jobs.length);
  let lastEnd: number | null = null;
  for (const [index, job] of jobs.entries()) {
    let url: string | null = null;
    try {
      url = await upload(job.file);
    } catch {
      deps.notice(`${job.file.name} 업로드에 실패했습니다. 다시 시도해 주세요.`, 'error');
    } finally {
      if (!editor.isDestroyed) changeUploadPending(editor, -1);
    }
    if (editor.isDestroyed) return;
    const where = findUploadPlaceholder(editor.state, job.id);
    if (where === null) {
      if (url) noticeOnce(DROPPED_MESSAGE, 'info');
      continue;
    }
    editor.view.dispatch(editor.state.tr.setMeta(uploadPlaceholderKey, { remove: job.id }));
    if (!url) continue;
    // 빈 문단에 넣으면 문단이 이미지로 통째로 바뀌어 그 안의 남은 자리 표시도 사라진다 — 넣기 전에 살아 있던 것을 이미지 뒤로 옮긴다
    const rest = jobs
      .slice(index + 1)
      .filter((next) => findUploadPlaceholder(editor.state, next.id) !== null)
      .map((next) => next.id);
    editor.chain().focus().insertContentAt(where, { type: 'image', attrs: { src: url } }).run();
    lastEnd = editor.state.selection.to;
    if (rest.length) {
      editor.view.dispatch(editor.state.tr.setMeta(uploadPlaceholderKey, { move: { ids: rest, pos: lastEnd } }));
    }
  }
  // 이미지 뒤에서 바로 이어 쓰도록 새 줄로 옮긴다(기존 에디터와 같은 동작)
  if (lastEnd !== null) editor.chain().focus(lastEnd).enter().run();
}
