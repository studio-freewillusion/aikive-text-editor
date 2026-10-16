import type { JSONContent } from '@tiptap/core';
import { migrateImageAttrs } from '../extensions';
import { isAikiveEmbedSrc } from '../sanitize';

// 빈 src 의 영상 래퍼가 남은 옛 글이 있어 불러올 때 지운다
function removeEmptyYouTubeDivs(html: string): string {
  if (typeof window === 'undefined') return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll<HTMLDivElement>('div[data-youtube-video], div[data-aikive-video]').forEach((div) => {
    if (!div.querySelector('iframe')?.getAttribute('src')?.trim()) div.remove();
  });
  return template.innerHTML;
}

const BLOCK_CONTAINERS = new Set(['doc', 'blockquote', 'listItem', 'tableCell', 'tableHeader']);

// JSON 본문은 노드 규칙(parseHTML)을 거치지 않아 허용 밖 영상 블록을 불러올 때 뺀다
function removeInvalidAikiveVideos(node: JSONContent, hosts: readonly string[]): JSONContent {
  if (!node.content) return node;
  const content = node.content
    .filter((child) => child.type !== 'aikiveVideo' || isAikiveEmbedSrc(String(child.attrs?.src ?? ''), hosts))
    .map((child) => removeInvalidAikiveVideos(child, hosts));
  // 영상 블록만 있던 인용·표 칸이 비면 문서 규칙에 어긋나 빈 문단을 둔다(문단·제목은 비어도 된다)
  const fill = !content.length && node.content.length > 0 && BLOCK_CONTAINERS.has(String(node.type));
  return { ...node, content: fill ? [{ type: 'paragraph' }] : content };
}

export function parseContent(raw: string | undefined, embedHosts: readonly string[] = []): string | JSONContent {
  if (!raw) return '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return removeEmptyYouTubeDivs(raw);
  }
  // JSON 이면 문서가 아니어도 그대로 넘긴다 — 지금 에디터와 같게 문자열은 글자로, 숫자 등은 빈 문서로 열린다
  if (typeof parsed !== 'object' || parsed === null) return parsed as JSONContent;
  return removeInvalidAikiveVideos(migrateImageAttrs(parsed as Record<string, unknown>) as JSONContent, embedHosts);
}
