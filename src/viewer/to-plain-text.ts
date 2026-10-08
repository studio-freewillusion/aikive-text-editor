import { parseLegacyDoc } from './render-legacy-json';
import type { TiptapNode } from './types';

// 문단·줄바꿈 경계는 띄워야 글자가 붙지 않는다 — 굵게 같은 글자 서식 태그는 단어 중간에 올 수 있어 그냥 뗀다
const BLOCK_BOUNDARY = /<\/(?:p|h[1-6]|li|blockquote|pre|div|td|th|tr)\s*>|<br\s*\/?>/gi;

export function toPlainText(content?: string | null): string {
  if (!content) return '';
  const doc = parseLegacyDoc(content);
  if (!doc) {
    return content.replace(BLOCK_BOUNDARY, ' ').replace(/<[^>]*>?/g, '').replace(/\s+/g, ' ').trim();
  }
  const parts: string[] = [];
  const walk = (nodes?: TiptapNode[]) =>
    nodes?.forEach((n) => {
      if (n.type === 'text' && n.text) parts.push(n.text);
      walk(n.content);
    });
  walk(doc.content);
  return parts.join(' ').trim();
}
