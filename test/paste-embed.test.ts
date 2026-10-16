import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { embedTargetOf, insertPastedEmbed } from '../src/editor/paste-embed';
import { buildExtensions } from '../src/editor/use-editor-setup';
import type { PastedUrlStorage } from '../src/extensions';
import { pastePlainText } from './paste';

const HOSTS = ['video.example.com'];
const AIKIVE = 'https://video.example.com/watch?v=abc123';
const EMBED_SRC = 'https://video.example.com/embed/watch/abc123';
const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const link = (url: string) => `<a href="${url}">${url}</a>`;

let editor: Editor | undefined;
const create = (content: string) => {
  editor = new Editor({
    element: document.createElement('div'),
    extensions: buildExtensions(true, {}, undefined, undefined, HOSTS),
    content,
  });
  return editor;
};
afterEach(() => editor?.destroy());
// 알림은 붙여넣기 반영 뒤 마이크로태스크로 온다 — 그 뒤에 줄 선다
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));
const storageOf = (ed: Editor) => (ed.storage as unknown as { pastedUrl: PastedUrlStorage }).pastedUrl;

describe('붙여넣은 주소 알림', () => {
  it('주소 하나만 붙이면 평소처럼 링크로 넣고 들어간 자리를 알린다', async () => {
    const ed = create('<p></p>');
    const onPaste = vi.fn();
    storageOf(ed).onPaste = onPaste;
    pastePlainText(ed, AIKIVE);
    await flush();
    expect(onPaste).toHaveBeenCalledWith({ from: 1, to: 1 + AIKIVE.length, url: AIKIVE });
    expect(ed.getHTML()).toContain(`href="${AIKIVE}"`);
  });

  it.each([`${AIKIVE}\n`, `${AIKIVE}\r\n`, `${AIKIVE} `, ` ${AIKIVE}`])('앞뒤 공백·줄바꿈이 붙어도 자른 주소만 넣고 알린다 (%j)', async (text) => {
    const ed = create('<p></p>');
    const onPaste = vi.fn();
    storageOf(ed).onPaste = onPaste;
    pastePlainText(ed, text);
    await flush();
    expect(onPaste).toHaveBeenCalledWith({ from: 1, to: 1 + AIKIVE.length, url: AIKIVE });
    expect(ed.state.doc.childCount).toBe(1);
    expect(ed.getHTML()).toContain(`href="${AIKIVE}"`);
  });

  it.each([`보세요 ${AIKIVE}`, 'hello', `${AIKIVE} ${YT}`])('「%s」 는 알리지 않는다', async (text) => {
    const ed = create('<p></p>');
    const onPaste = vi.fn();
    storageOf(ed).onPaste = onPaste;
    pastePlainText(ed, text);
    await flush();
    expect(onPaste).not.toHaveBeenCalled();
  });

  it('글자를 고른 채 붙이면(링크 걸기) 알리지 않는다', async () => {
    const ed = create('<p>안녕</p>');
    const onPaste = vi.fn();
    storageOf(ed).onPaste = onPaste;
    ed.commands.setTextSelection({ from: 1, to: 3 });
    pastePlainText(ed, AIKIVE);
    await flush();
    expect(onPaste).not.toHaveBeenCalled();
  });
});

describe('embedTargetOf', () => {
  it('허용 호스트 주소는 embed 주소의 영상 블록', () => {
    expect(embedTargetOf(AIKIVE, { youtube: true, hosts: HOSTS })).toEqual({ type: 'aikiveVideo', src: EMBED_SRC });
  });
  it('유튜브는 youtube 기능이 켜졌을 때만', () => {
    expect(embedTargetOf(YT, { youtube: true, hosts: HOSTS })).toEqual({ type: 'youtube', src: YT });
    expect(embedTargetOf(YT, { youtube: false, hosts: HOSTS })).toBeNull();
  });
  it('그 밖의 주소는 null', () => {
    expect(embedTargetOf('https://other.example.com/watch?v=abc123', { youtube: true, hosts: HOSTS })).toBeNull();
    expect(embedTargetOf('https://example.com/a', { youtube: true, hosts: HOSTS })).toBeNull();
  });
});

describe('insertPastedEmbed', () => {
  const aikive = { type: 'aikiveVideo' as const, src: EMBED_SRC };
  const rangeAt = (from: number, url = AIKIVE) => ({ from, to: from + url.length, url });

  it('주소만 있는 줄은 그 줄을 영상 블록으로 바꾼다', () => {
    const ed = create(`<p>${link(AIKIVE)}</p><p>다음</p>`);
    expect(insertPastedEmbed(ed, rangeAt(1), aikive)).toBe(true);
    const html = ed.getHTML();
    expect(html.startsWith(`<div data-aikive-video=""><iframe src="${EMBED_SRC}"`)).toBe(true);
    expect(html).not.toContain('href=');
    expect(html).toContain('</div><p></p><p>다음</p>');
  });

  it('다른 글자가 있는 줄은 주소만 지우고 그 줄 아래에 넣는다', () => {
    const ed = create(`<p>보세요 ${link(AIKIVE)}</p><p>다음</p>`);
    expect(insertPastedEmbed(ed, rangeAt(5), aikive)).toBe(true);
    expect(ed.getHTML()).toMatch(/^<p>보세요 <\/p><div data-aikive-video=""><iframe src="https:\/\/video\.example\.com\/embed\/watch\/abc123"/);
  });

  it('목록 항목 안이면 그 항목 안, 문단 아래에 넣는다', () => {
    const ed = create(`<ul><li><p>${link(AIKIVE)}</p></li></ul>`);
    expect(insertPastedEmbed(ed, rangeAt(3), aikive)).toBe(true);
    expect(ed.getHTML()).toContain('<li><p></p><div data-aikive-video=""');
  });

  it('유튜브 주소는 유튜브 블록으로 넣는다', () => {
    const ed = create(`<p>${link(YT)}</p>`);
    expect(insertPastedEmbed(ed, rangeAt(1, YT), { type: 'youtube', src: YT })).toBe(true);
    expect(ed.getHTML()).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('그 사이 붙인 글자가 바뀌었으면 넣지 않는다', () => {
    const ed = create(`<p>${link(AIKIVE)}</p>`);
    ed.commands.insertContentAt(3, 'x');
    const before = ed.getHTML();
    expect(insertPastedEmbed(ed, rangeAt(1), aikive)).toBe(false);
    expect(ed.getHTML()).toBe(before);
  });
});
