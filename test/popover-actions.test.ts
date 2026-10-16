import { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ALT_MAX_LENGTH,
  LINK_EMPTY_MESSAGE,
  LINK_SCHEME_MESSAGE,
  applyAlt,
  applyLink,
  currentLink,
  removeLink,
} from '../src/editor/popover-actions';
import { buildExtensions } from '../src/editor/use-editor-setup';

let editor: Editor;
const create = (content: string) => {
  editor = new Editor({ element: document.createElement('div'), extensions: buildExtensions(true), content });
  return editor;
};
const IMG = '<img src="https://cdn.example.com/a.png">';

afterEach(() => editor?.destroy());

describe('applyLink', () => {
  it('스킴 없는 주소는 https 를 붙여 새 탭 링크로 건다', () => {
    create('<p>안녕</p>').commands.selectAll();
    expect(applyLink(editor, ' example.com ', true)).toBeNull();
    const html = editor.getHTML();
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('같은 탭 링크는 다시 불러와도 HTML 이 같다', () => {
    create('<p>안녕</p>').commands.selectAll();
    applyLink(editor, 'https://example.com', false);
    const saved = editor.getHTML();
    expect(saved).toContain('target="_self"');
    editor.destroy();
    create(saved);
    expect(editor.getHTML()).toBe(saved);
  });

  it.each(['javascript:alert(1)', 'mailto:a@b.com', 'ftp://example.com'])('%s 는 거부하고 본문을 바꾸지 않는다', (input) => {
    create('<p>안녕</p>').commands.selectAll();
    expect(applyLink(editor, input, true)).toBe(LINK_SCHEME_MESSAGE);
    expect(editor.getHTML()).not.toContain('<a');
  });

  it('빈 주소는 거부한다', () => {
    create('<p>안녕</p>').commands.selectAll();
    expect(applyLink(editor, '   ', true)).toBe(LINK_EMPTY_MESSAGE);
  });

  it('선택 없이 커서만 있으면 주소를 글자로 넣고 링크를 건다', () => {
    create('<p>안녕</p>').commands.setTextSelection(3);
    expect(applyLink(editor, 'example.com', true)).toBeNull();
    expect(editor.getHTML()).toMatch(/<p>안녕<a [^>]*href="https:\/\/example.com"[^>]*>https:\/\/example.com<\/a><\/p>/);
  });

  it('링크 안에 커서가 있으면 그 링크 전체의 주소를 바꾼다', () => {
    create('<p><a href="https://a.example.com" target="_blank" rel="noopener noreferrer">글자</a></p>').commands.setTextSelection(2);
    applyLink(editor, 'https://b.example.com', true);
    expect(editor.getHTML()).toContain('href="https://b.example.com"');
    expect(editor.getHTML()).toContain('>글자</a>');
  });

  it('고른 이미지에는 이미지 링크로 건다', () => {
    create(IMG).commands.setNodeSelection(0);
    expect(applyLink(editor, 'example.com', true)).toBeNull();
    expect(editor.getHTML()).toContain('<a href="https://example.com" target="_blank"');
  });

  it('이미지 링크를 같은 탭으로 걸면 target·rel 이 남지 않는다', () => {
    create(`<a href="https://example.com" target="_blank">${IMG}</a>`).commands.setNodeSelection(0);
    applyLink(editor, 'https://example.com', false);
    expect(editor.getHTML()).toContain('<a href="https://example.com"');
    expect(editor.getHTML()).not.toMatch(/target=|rel=/);
  });
});

describe('currentLink·removeLink', () => {
  it('링크가 아니면 null', () => {
    create('<p>안녕</p>').commands.setTextSelection(2);
    expect(currentLink(editor)).toBeNull();
  });

  it('같은 탭 링크는 newTab false 로 읽고, 해제하면 글자만 남는다', () => {
    create('<p><a href="https://example.com" target="_self" rel="noopener noreferrer nofollow">글자</a></p>').commands.setTextSelection(2);
    expect(currentLink(editor)).toEqual({ href: 'https://example.com', newTab: false });
    removeLink(editor);
    expect(editor.getHTML()).toBe('<p>글자</p>');
  });

  it('이미지 링크를 읽고, 해제하면 이미지는 남긴다', () => {
    create(`<a href="https://example.com" target="_blank">${IMG}</a>`).commands.setNodeSelection(0);
    expect(currentLink(editor)).toEqual({ href: 'https://example.com', newTab: true });
    removeLink(editor);
    expect(editor.getHTML()).not.toContain('<a');
    expect(editor.getHTML()).toContain('<img');
  });
});

describe('applyAlt', () => {
  it('대체 텍스트를 넣고, 비우면 지우고, 200자로 자른다', () => {
    create(IMG).commands.setNodeSelection(0);
    applyAlt(editor, ' 장면 ');
    expect(editor.getHTML()).toContain('alt="장면"');
    editor.commands.setNodeSelection(0);
    applyAlt(editor, '');
    expect(editor.getHTML()).not.toContain('alt=');
    editor.commands.setNodeSelection(0);
    applyAlt(editor, 'a'.repeat(250));
    expect(editor.getHTML()).toContain(`alt="${'a'.repeat(ALT_MAX_LENGTH)}"`);
  });
});

describe('적용 뒤 이어 쓰기', () => {
  it('글자에 링크를 건 뒤 이어 치면 링크 글자를 지우지 않고 링크 밖에 쓴다', () => {
    create('<p>hello world</p>').commands.setTextSelection({ from: 1, to: 6 });
    applyLink(editor, 'example.com', true);
    expect(editor.state.selection.empty).toBe(true);
    editor.commands.insertContent('Q');
    expect(editor.getHTML()).toMatch(/<a [^>]*>hello<\/a>Q world/);
  });

  it('전체 선택 뒤 링크를 걸고 이어 쳐도 링크에 붙지 않는다', () => {
    create('<p>hello</p><p>world</p>').commands.selectAll();
    applyLink(editor, 'example.com', true);
    editor.commands.insertContent('X');
    expect(editor.getHTML()).toMatch(/world<\/a>X<\/p>$/);
  });

  it('주소를 글자로 넣은 뒤 이어 쳐도 링크에 붙지 않는다', () => {
    create('<p>안녕</p>').commands.setTextSelection(3);
    applyLink(editor, 'example.com', true);
    editor.commands.insertContent('.');
    expect(editor.getHTML()).toMatch(/https:\/\/example.com<\/a>\.<\/p>/);
  });

  it.each(['link', 'alt'] as const)('이미지 %s 적용 뒤 이어 쳐도 이미지가 남고 새 문단은 만들지 않는다', (kind) => {
    create('<p>a</p><img src="https://cdn.example.com/a.png"><p>b</p>').commands.setNodeSelection(3);
    if (kind === 'link') applyLink(editor, 'example.com', true);
    else applyAlt(editor, '장면');
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    editor.commands.insertContent('Q');
    expect(editor.getHTML()).toContain('<img');
    expect(editor.getHTML()).toMatch(/<p>Qb<\/p>$/);
  });
});
