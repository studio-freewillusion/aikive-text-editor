import type { Editor } from '@tiptap/core';
import { NodeSelection, Selection } from '@tiptap/pm/state';
import { normalizeImageHref } from '../sanitize';
import { placeCaretAfterBlock } from './caret-after';

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
    placeCaretAfterBlock(editor, editor.state.selection.to, { newLine: false });
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
  } else if (!editor.chain().focus().extendMarkRange('link').setLink(attrs).run()) {
    return LINK_SCHEME_MESSAGE;
  }
  // 링크 끝으로 커서를 옮기고 다음 입력엔 링크를 빼야 이어 쓴 글자가 링크를 지우거나 링크에 붙지 않는다
  const { tr } = editor.state;
  // 전체·여러 칸 선택의 끝은 블록 경계라 가장 가까운 글자 자리로 맞춘다
  tr.setSelection(Selection.near(tr.doc.resolve(editor.state.selection.to), -1)).removeStoredMark(editor.schema.marks.link);
  editor.view.dispatch(tr);
  return null;
}

export function removeLink(editor: Editor): void {
  if (editor.isActive('image')) editor.chain().focus().unsetImageLink().run();
  else editor.chain().focus().extendMarkRange('link').unsetLink().run();
}

export function insertYoutube(editor: Editor, input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return YOUTUBE_INVALID_MESSAGE;
  const src = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('//') ? trimmed : `https://${trimmed}`;
  if (!editor.can().setYoutubeVideo({ src })) return YOUTUBE_INVALID_MESSAGE;
  const { selection } = editor.state;
  // 이미지 등 블록이 통째로 선택돼 있으면 바꾸지 않고 그 뒤에 넣는다
  if (selection instanceof NodeSelection) {
    editor.chain().focus().insertContentAt(selection.to, { type: 'youtube', attrs: { src } }).run();
  } else {
    editor.chain().focus().setYoutubeVideo({ src }).run();
  }
  placeCaretAfterBlock(editor, editor.state.selection.to, { newLine: true });
  return null;
}

export function applyAlt(editor: Editor, input: string): void {
  editor
    .chain()
    .focus()
    .updateAttributes('image', { alt: input.trim().slice(0, ALT_MAX_LENGTH) || null })
    .run();
  placeCaretAfterBlock(editor, editor.state.selection.to, { newLine: false });
}
