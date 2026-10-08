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
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
      return migrateImageAttrs(parsed) as JSONContent;
    }
  } catch {
    // HTML
  }
  return removeEmptyYouTubeDivs(raw);
}
