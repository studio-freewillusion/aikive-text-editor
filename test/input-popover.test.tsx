import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AikiveTextEditor, type AikiveTextEditorHandle, type AikiveTextEditorProps } from '../src/editor';
import { placePopover } from '../src/ui/input-popover';

const setup = async (props: Partial<AikiveTextEditorProps> = {}, onFormSubmit?: () => void) => {
  const ref = createRef<AikiveTextEditorHandle>();
  const editorNode = <AikiveTextEditor ref={ref} initialContent="<p>안녕</p>" {...props} />;
  const { container } = render(
    onFormSubmit ? (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onFormSubmit();
        }}
      >
        {editorNode}
      </form>
    ) : (
      editorNode
    ),
  );
  let ed: Editor | undefined;
  await waitFor(() => {
    ed = (container.querySelector('.ProseMirror') as unknown as { editor?: Editor } | null)?.editor;
    expect(ed).toBeTruthy();
  });
  return { ref, ed: ed!, user: userEvent.setup() };
};

afterEach(() => vi.restoreAllMocks());

describe('placePopover', () => {
  const size = { width: 300, height: 120 };
  const viewport = { width: 1000, height: 800 };

  it('기본은 기준 아래 8px', () => {
    expect(placePopover({ left: 100, top: 200, bottom: 220 }, size, viewport)).toEqual({ top: 228, left: 100 });
  });

  it('아래가 화면 밖이면 위로 연다', () => {
    expect(placePopover({ left: 100, top: 700, bottom: 720 }, size, viewport)).toEqual({ top: 572, left: 100 });
  });

  it('위도 모자라면 아래에 둔다', () => {
    expect(placePopover({ left: 100, top: 50, bottom: 720 }, size, viewport).top).toBe(728);
  });

  it('오른쪽으로 넘치면 화면 안으로 민다', () => {
    expect(placePopover({ left: 900, top: 0, bottom: 20 }, size, viewport).left).toBe(692);
  });
});

describe('링크 창', () => {
  it('링크 연결을 누르면 창이 열리고 주소칸에 포커스, Enter 로 적용하고 닫힌다', async () => {
    const { ref, ed, user } = await setup();
    act(() => {
      ed.commands.selectAll();
    });
    await user.click(screen.getByRole('button', { name: '링크 연결' }));
    const input = screen.getByLabelText('주소');
    expect(input).toHaveFocus();
    expect(screen.getByLabelText('새 탭에서 열기')).toBeChecked();
    await user.type(input, 'example.com{Enter}');
    expect(screen.queryByRole('dialog', { name: '링크' })).toBeNull();
    expect(ref.current!.getHTML()).toContain('href="https://example.com"');
  });

  it('잘못된 주소는 창 안에 빨간 문구로 알리고 창을 닫지 않는다', async () => {
    const { ref, ed, user } = await setup();
    act(() => {
      ed.commands.selectAll();
    });
    await user.click(screen.getByRole('button', { name: '링크 연결' }));
    await user.type(screen.getByLabelText('주소'), 'javascript:alert(1){Enter}');
    expect(screen.getByRole('dialog', { name: '링크' })).toBeInTheDocument();
    expect(screen.getByText('http 또는 https 주소만 넣을 수 있습니다.')).toBeInTheDocument();
    expect(screen.getByLabelText('주소')).toHaveAttribute('aria-invalid', 'true');
    await user.type(screen.getByLabelText('주소'), 'x');
    expect(screen.queryByText('http 또는 https 주소만 넣을 수 있습니다.')).toBeNull();
    expect(ref.current!.getHTML()).not.toContain('<a');
  });

  it('Esc 는 적용 없이 닫는다', async () => {
    const { ref, ed, user } = await setup();
    act(() => {
      ed.commands.selectAll();
    });
    await user.click(screen.getByRole('button', { name: '링크 연결' }));
    await user.type(screen.getByLabelText('주소'), 'example.com{Escape}');
    expect(screen.queryByRole('dialog', { name: '링크' })).toBeNull();
    expect(ref.current!.getHTML()).not.toContain('<a');
  });

  it('창 바깥을 누르면 닫는다', async () => {
    const { ed, user } = await setup();
    act(() => {
      ed.commands.selectAll();
    });
    await user.click(screen.getByRole('button', { name: '링크 연결' }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog', { name: '링크' })).toBeNull();
  });

  it('바깥 form 안에서 Enter 를 눌러도 form 을 제출하지 않는다', async () => {
    const submit = vi.fn();
    const { ed, user } = await setup({}, submit);
    act(() => {
      ed.commands.selectAll();
    });
    await user.click(screen.getByRole('button', { name: '링크 연결' }));
    await user.type(screen.getByLabelText('주소'), 'example.com{Enter}');
    expect(submit).not.toHaveBeenCalled();
  });

  it('한글 조합 중 Enter 는 적용하지 않는다', async () => {
    const { ref, ed, user } = await setup();
    act(() => {
      ed.commands.selectAll();
    });
    await user.click(screen.getByRole('button', { name: '링크 연결' }));
    const input = screen.getByLabelText('주소');
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(screen.getByRole('dialog', { name: '링크' })).toBeInTheDocument();
    expect(ref.current!.getHTML()).not.toContain('<a');
  });

  it('이미 링크면 지금 값으로 채우고 열기·링크 해제를 보인다', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const { ref, ed, user } = await setup({
      initialContent: '<p><a href="https://example.com" target="_self" rel="noopener noreferrer nofollow">글자</a></p>',
    });
    act(() => {
      ed.commands.setTextSelection(2);
    });
    await user.click(screen.getByRole('button', { name: '링크 연결' }));
    expect(screen.getByLabelText('주소')).toHaveValue('https://example.com');
    expect(screen.getByLabelText('새 탭에서 열기')).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: '열기' }));
    expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
    await user.click(screen.getByRole('button', { name: '링크 해제' }));
    expect(ref.current!.getHTML()).toBe('<p>글자</p>');
  });

  it('새 링크에는 열기·링크 해제가 없다', async () => {
    const { ed, user } = await setup();
    act(() => {
      ed.commands.selectAll();
    });
    await user.click(screen.getByRole('button', { name: '링크 연결' }));
    expect(screen.queryByRole('button', { name: '열기' })).toBeNull();
    expect(screen.queryByRole('button', { name: '링크 해제' })).toBeNull();
  });

  it('Ctrl+K 로 링크 창을 연다', async () => {
    const { ed } = await setup();
    act(() => {
      ed.commands.selectAll();
    });
    fireEvent.keyDown(ed.view.dom, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('dialog', { name: '링크' })).toBeInTheDocument();
  });

  it('features.link 를 끄면 Ctrl+K 가 열지 않는다', async () => {
    const { ed } = await setup({ features: { link: false } });
    act(() => {
      ed.commands.selectAll();
    });
    fireEvent.keyDown(ed.view.dom, { key: 'k', ctrlKey: true });
    expect(screen.queryByRole('dialog', { name: '링크' })).toBeNull();
  });
});
