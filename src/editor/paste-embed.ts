import type { Editor } from '@tiptap/core';
import { isValidYoutubeUrl } from '@tiptap/extension-youtube';
import type { PastedUrlRange } from '../extensions';
import { aikiveEmbedSrc, parseAikiveVideoUrl } from '../sanitize';
import { placeCaretAfterBlock } from './caret-after';

export interface EmbedTarget {
  type: 'youtube' | 'aikiveVideo';
  src: string;
}

export function embedTargetOf(url: string, { youtube, hosts }: { youtube: boolean; hosts: readonly string[] }): EmbedTarget | null {
  const ref = parseAikiveVideoUrl(url, hosts);
  if (ref) return { type: 'aikiveVideo', src: aikiveEmbedSrc(ref) };
  if (youtube && isValidYoutubeUrl(url)) return { type: 'youtube', src: url };
  return null;
}

// 그 줄에 주소뿐이면 줄을 블록으로 바꾸고, 다른 글자가 있거나 목록·표 안이면 주소만 지우고 그 줄 아래에 넣는다
export function insertPastedEmbed(editor: Editor, { from, to, url }: PastedUrlRange, target: EmbedTarget): boolean {
  const { doc } = editor.state;
  if (to > doc.content.size || doc.textBetween(from, to) !== url) return false;
  const $from = doc.resolve(from);
  const node = { type: target.type, attrs: { src: target.src } };
  const start = $from.before();
  const end = $from.after();
  const chain = editor.chain().focus();
  const ok =
    $from.depth === 1 && $from.parent.textContent.trim() === url
      ? chain.insertContentAt({ from: start, to: end }, node).run()
      : chain.deleteRange({ from, to }).insertContentAt(end - (to - from), node).run();
  if (ok) placeCaretAfterBlock(editor, editor.state.selection.to, { newLine: true });
  return ok;
}
