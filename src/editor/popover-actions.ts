import type { Editor } from '@tiptap/core';
import { normalizeImageHref } from '../sanitize';

export const LINK_EMPTY_MESSAGE = '주소를 입력해 주세요.';
export const LINK_SCHEME_MESSAGE = 'http 또는 https 주소만 넣을 수 있습니다.';
export const YOUTUBE_INVALID_MESSAGE = '유튜브 주소를 확인해 주세요.';
export const ALT_MAX_LENGTH = 200;

export interface CurrentLink {
  href: string;
  newTab: boolean;
}

export function currentLink(editor: Editor): CurrentLink | null {
  if (editor.isActive('image')) {
    const { href, target } = editor.getAttributes('image');
    return href ? { href, newTab: target === '_blank' } : null;
  }
  if (!editor.isActive('link')) return null;
  const { href, target } = editor.getAttributes('link');
  return { href: href ?? '', newTab: target === '_blank' };
}

export function applyLink(editor: Editor, input: string, newTab: boolean): string | null {
  if (!input.trim()) return LINK_EMPTY_MESSAGE;
  const href = normalizeImageHref(input);
  if (!href) return LINK_SCHEME_MESSAGE;
  // 이미지는 링크 서식이 안 붙어 이미지 속성으로 건다
  if (editor.isActive('image')) {
    editor.chain().focus().setImageLink({ href, target: newTab ? '_blank' : null }).run();
    return null;
  }
  // 같은 탭은 _self·기본 rel 로 남긴다 — 비워 두면 다시 불러올 때 기본값(새 탭·rel)이 붙어 HTML 이 달라진다
  const attrs = {
    href,
    target: newTab ? '_blank' : '_self',
    rel: newTab ? 'noopener noreferrer' : 'noopener noreferrer nofollow',
  };
  if (editor.state.selection.empty && !editor.isActive('link')) {
    editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs }] }).run();
    return null;
  }
  return editor.chain().focus().extendMarkRange('link').setLink(attrs).run() ? null : LINK_SCHEME_MESSAGE;
}

export function removeLink(editor: Editor): void {
  if (editor.isActive('image')) editor.chain().focus().unsetImageLink().run();
  else editor.chain().focus().extendMarkRange('link').unsetLink().run();
}

export function insertYoutube(editor: Editor, input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return YOUTUBE_INVALID_MESSAGE;
  const src = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('//') ? trimmed : `https://${trimmed}`;
  return editor.chain().focus().setYoutubeVideo({ src }).run() ? null : YOUTUBE_INVALID_MESSAGE;
}

export function applyAlt(editor: Editor, input: string): void {
  editor
    .chain()
    .focus()
    .updateAttributes('image', { alt: input.trim().slice(0, ALT_MAX_LENGTH) || null })
    .run();
}
