import type { JSONContent } from '@tiptap/core';
import { migrateImageAttrs } from '../extensions';

// 빈 src 의 유튜브 래퍼가 남은 옛 글이 있어 불러올 때 지운다
function removeEmptyYouTubeDivs(html: string): string {
  if (typeof window === 'undefined') return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll<HTMLDivElement>('div[data-youtube-video]').forEach((div) => {
    if (!div.querySelector('iframe')?.getAttribute('src')?.trim()) div.remove();
  });
  return template.innerHTML;
}

export function parseContent(raw: string | undefined): string | JSONContent {
  if (!raw) return '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return removeEmptyYouTubeDivs(raw);
  }
  // JSON 이면 문서가 아니어도 그대로 넘긴다 — 지금 에디터와 같게 문자열은 글자로, 숫자 등은 빈 문서로 열린다
  return (typeof parsed === 'object' && parsed !== null ? migrateImageAttrs(parsed as Record<string, unknown>) : parsed) as JSONContent;
}
