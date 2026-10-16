import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AikiveTextEditor, type AikiveTextEditorHandle, type AikiveTextEditorProps } from '../src/editor';
import { pastePlainText } from './paste';

const HOSTS = ['video.example.com'];
const AIKIVE = 'https://video.example.com/watch?v=abc123';
const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const setup = async (props: Partial<AikiveTextEditorProps> = {}) => {
  const ref = createRef<AikiveTextEditorHandle>();
  const { container } = render(<AikiveTextEditor ref={ref} initialContent="<p></p>" embedHosts={HOSTS} {...props} />);
  let ed: Editor | undefined;
  await waitFor(() => {
    ed = (container.querySelector('.ProseMirror') as unknown as { editor?: Editor } | null)?.editor;
    expect(ed).toBeTruthy();
  });
  return { ref, ed: ed! };
};
const paste = async (ed: Editor, text: string) => {
  await act(async () => {
    pastePlainText(ed, text);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  });
};
const menu = () => screen.queryByRole('menu', { name: '붙여넣기 방식' });

describe('붙여넣기 선택 창', () => {
  it('주소만 붙이면 창이 뜨고 「플레이어로 넣기」 로 영상 블록이 된다', async () => {
    const { ref, ed } = await setup();
    await paste(ed, AIKIVE);
    expect(menu()).not.toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: '플레이어로 넣기' }));
    expect(menu()).toBeNull();
    expect(ref.current!.getHTML()).toContain('<div data-aikive-video=""><iframe src="https://video.example.com/embed/watch/abc123"');
    expect(ref.current!.getHTML()).not.toContain('href=');
  });

  it('Enter 는 기본 「링크로 두기」 — 창만 닫고 본문은 그대로다', async () => {
    const { ref, ed } = await setup();
    await paste(ed, AIKIVE);
    const before = ref.current!.getHTML();
    fireEvent.keyDown(ed.view.dom, { key: 'Enter' });
    expect(menu()).toBeNull();
    expect(ref.current!.getHTML()).toBe(before);
  });

  it('↑ 로 「플레이어로 넣기」 를 고르고 Enter 로 넣는다', async () => {
    const { ref, ed } = await setup();
    await paste(ed, AIKIVE);
    fireEvent.keyDown(ed.view.dom, { key: 'ArrowUp' });
    fireEvent.keyDown(ed.view.dom, { key: 'Enter' });
    expect(ref.current!.getHTML()).toContain('data-aikive-video');
  });

  it('한글 조합을 끝내는 Enter 는 고른 항목을 실행하지 않는다', async () => {
    const { ref, ed } = await setup();
    await paste(ed, AIKIVE);
    fireEvent.keyDown(ed.view.dom, { key: 'ArrowUp' });
    fireEvent.keyDown(ed.view.dom, { key: 'Enter', isComposing: true });
    expect(ref.current!.getHTML()).not.toContain('data-aikive-video');
  });

  it('Esc 는 창만 닫고 바깥(document 캡처)으로 넘기지 않는다', async () => {
    const { ref, ed } = await setup();
    const outer = vi.fn();
    document.addEventListener('keydown', outer, true);
    try {
      await paste(ed, AIKIVE);
      fireEvent.keyDown(ed.view.dom, { key: 'Escape' });
      expect(menu()).toBeNull();
      expect(outer).not.toHaveBeenCalled();
      expect(ref.current!.getHTML()).toContain(`href="${AIKIVE}"`);
    } finally {
      document.removeEventListener('keydown', outer, true);
    }
  });

  it('이어 쓰면 닫히고 링크는 그대로다', async () => {
    const { ref, ed } = await setup();
    await paste(ed, AIKIVE);
    act(() => {
      ed.commands.insertContent(' 다음');
    });
    expect(menu()).toBeNull();
    expect(ref.current!.getHTML()).not.toContain('data-aikive-video');
  });

  it('바깥을 누르면 닫힌다', async () => {
    const { ed } = await setup();
    await paste(ed, AIKIVE);
    fireEvent.pointerDown(document.body);
    expect(menu()).toBeNull();
  });

  it('탭 전환(restoreSnapshot)·본문 교체 때 닫힌다', async () => {
    const { ref, ed } = await setup();
    const snapshot = ref.current!.takeSnapshot()!;
    await paste(ed, AIKIVE);
    expect(menu()).not.toBeNull();
    act(() => {
      ref.current!.restoreSnapshot(snapshot);
    });
    expect(menu()).toBeNull();
    await paste(ed, AIKIVE);
    expect(menu()).not.toBeNull();
    act(() => {
      ref.current!.resetContent('<p>새 글</p>');
    });
    expect(menu()).toBeNull();
  });

  it('유튜브 주소도 고르면 유튜브 블록이 된다', async () => {
    const { ref, ed } = await setup();
    await paste(ed, YT);
    fireEvent.click(screen.getByRole('menuitem', { name: '플레이어로 넣기' }));
    expect(ref.current!.getHTML()).toContain('data-youtube-video');
  });

  it.each([
    ['섞인 글', `보세요 ${AIKIVE}`, {}],
    ['모르는 주소', 'https://example.com/a', {}],
    ['허용 밖 호스트', 'https://other.example.com/watch?v=abc123', {}],
    ['유튜브 기능 끔', YT, { features: { youtube: false } }],
    ['영상 호스트 없음', AIKIVE, { embedHosts: [] }],
  ])('%s 는 창을 띄우지 않는다', async (_name, text, props) => {
    const { ed } = await setup(props as Partial<AikiveTextEditorProps>);
    await paste(ed, text);
    expect(menu()).toBeNull();
  });

  it('수정 키가 눌린 Enter 는 가로채지 않는다', async () => {
    const { ref, ed } = await setup();
    await paste(ed, AIKIVE);
    fireEvent.keyDown(ed.view.dom, { key: 'ArrowUp' });
    fireEvent.keyDown(ed.view.dom, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(ed.view.dom, { key: 'Enter', metaKey: true });
    expect(ref.current!.getHTML()).not.toContain('data-aikive-video');
  });

  it('보조기술이 창과 고른 항목을 알 수 있게 본문에 연결하고, 닫으면 뗀다', async () => {
    const { ed } = await setup();
    await paste(ed, AIKIVE);
    const dom = ed.view.dom;
    expect(dom.getAttribute('aria-controls')).toBe(screen.getByRole('menu').id);
    expect(dom.getAttribute('aria-activedescendant')).toBe(screen.getByRole('menuitem', { name: '링크로 두기' }).id);
    fireEvent.keyDown(dom, { key: 'ArrowUp' });
    expect(dom.getAttribute('aria-activedescendant')).toBe(screen.getByRole('menuitem', { name: '플레이어로 넣기' }).id);
    fireEvent.keyDown(dom, { key: 'Escape' });
    expect(dom.hasAttribute('aria-controls')).toBe(false);
    expect(dom.hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('플레이어로 넣은 뒤 되돌리면 붙인 링크로 돌아간다', async () => {
    const { ref, ed } = await setup();
    await paste(ed, AIKIVE);
    fireEvent.click(screen.getByRole('menuitem', { name: '플레이어로 넣기' }));
    act(() => {
      ed.commands.undo();
    });
    expect(ref.current!.getHTML()).not.toContain('data-aikive-video');
    expect(ref.current!.getHTML()).toContain(`href="${AIKIVE}"`);
  });

  it('코드 블록 안에 붙인 주소는 창을 띄우지 않는다', async () => {
    const { ed } = await setup({ initialContent: '<pre><code>x</code></pre>' });
    await paste(ed, AIKIVE);
    expect(menu()).toBeNull();
  });
});
