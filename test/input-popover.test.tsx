import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('위아래 모두 모자라면 화면 안으로 끌어올린다', () => {
    expect(placePopover({ left: 100, top: 50, bottom: 720 }, size, viewport).top).toBe(672);
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

describe('유튜브 창', () => {
  it('주소를 넣고 Enter 로 유튜브를 넣는다', async () => {
    const { ref, ed, user } = await setup();
    act(() => {
      ed.commands.setTextSelection(3);
    });
    await user.click(screen.getByRole('button', { name: '유튜브 넣기' }));
    await user.type(screen.getByLabelText('유튜브 주소'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ{Enter}');
    expect(screen.queryByRole('dialog', { name: '유튜브' })).toBeNull();
    expect(ref.current!.getHTML()).toContain('data-youtube-video');
  });

  it('유튜브가 아닌 주소는 창 안에 알린다', async () => {
    const { ed, user } = await setup();
    act(() => {
      ed.commands.setTextSelection(3);
    });
    await user.click(screen.getByRole('button', { name: '유튜브 넣기' }));
    await user.type(screen.getByLabelText('유튜브 주소'), 'https://example.com/v');
    await user.click(screen.getByRole('button', { name: '넣기' }));
    expect(screen.getByText('유튜브 주소를 확인해 주세요.')).toBeInTheDocument();
  });
});

describe('이미지 조작 바', () => {
  const IMG = '<p>a</p><img src="https://cdn.example.com/a.png">';
  // jsdom 은 elementFromPoint 가 없어 본문 안 mousedown 을 ProseMirror 가 처리하다 예외가 난다 — 조작 바는 click 만 보낸다
  const showControls = (container: HTMLElement) => {
    fireEvent.click(container.querySelector('.ProseMirror img')!.parentElement!);
  };

  it('대체 텍스트 버튼으로 alt 를 넣는다', async () => {
    const { ref, user } = await setup({ initialContent: IMG });
    showControls(document.body);
    fireEvent.click(document.querySelector('[data-image-control][aria-label="대체 텍스트"]')!);
    const input = screen.getByRole('textbox', { name: '대체 텍스트' });
    expect(input).toHaveAttribute('maxlength', '200');
    await user.type(input, '장면{Enter}');
    expect(ref.current!.getHTML()).toContain('alt="장면"');
  });

  it('링크 버튼은 이미지 링크 창을 연다', async () => {
    const { ref, user } = await setup({ initialContent: IMG });
    showControls(document.body);
    fireEvent.click(document.querySelector('[data-image-control][aria-label="링크 연결"]')!);
    await user.type(screen.getByLabelText('주소'), 'example.com{Enter}');
    expect(ref.current!.getHTML()).toMatch(/<a href="https:\/\/example.com" target="_blank"[^>]*><img/);
  });
});

describe('입력 창과 바깥 환경', () => {
  it('새 탭 체크박스에서 Enter 도 바깥 form 제출을 막는다', async () => {
    const { ed, user } = await setup({}, () => {});
    act(() => {
      ed.commands.selectAll();
    });
    await user.click(screen.getByRole('button', { name: '링크 연결' }));
    const box = screen.getByLabelText('새 탭에서 열기');
    const event = createEvent.keyDown(box, { key: 'Enter' });
    fireEvent(box, event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('Esc 는 창만 닫고 바깥 다이얼로그(document 캡처 리스너)까지 가지 않는다', async () => {
    const outer = vi.fn();
    document.addEventListener('keydown', outer, true);
    try {
      const { ed, user } = await setup();
      act(() => {
        ed.commands.selectAll();
      });
      await user.click(screen.getByRole('button', { name: '링크 연결' }));
      fireEvent.keyDown(screen.getByLabelText('주소'), { key: 'Escape' });
      expect(screen.queryByRole('dialog', { name: '링크' })).toBeNull();
      expect(outer.mock.calls.filter(([e]) => (e as KeyboardEvent).key === 'Escape')).toHaveLength(0);
    } finally {
      document.removeEventListener('keydown', outer, true);
    }
  });

  it('transform 된 조상 안에서도 화면 기준 위치에 둔다', async () => {
    const original = HTMLElement.prototype.getBoundingClientRect;
    // 다이얼로그의 transform 때문에 fixed 기준점이 화면에서 (100, 50) 만큼 밀린 상황
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (!this.classList.contains('aikive-popover')) return original.call(this);
      const left = Number.parseFloat(this.style.left) || 0;
      const top = Number.parseFloat(this.style.top) || 0;
      return new DOMRect(left + 100, top + 50, 0, 0);
    });
    const { ed, user } = await setup();
    act(() => {
      ed.commands.selectAll();
    });
    await user.click(screen.getByRole('button', { name: '링크 연결' }));
    const dialog = screen.getByRole('dialog', { name: '링크' });
    expect(dialog.getBoundingClientRect().left).toBe(8);
    expect(dialog.getBoundingClientRect().top).toBe(8);
  });

  it('창이 열린 채 업로드가 끝나도 입력칸 포커스와 고른 글자를 지킨다', async () => {
    let resolve!: (url: string) => void;
    const upload = () => new Promise<string>((r) => (resolve = r));
    const { ref, ed, user } = await setup({ initialContent: '<p>안녕 세상</p>', onUploadImage: upload });
    act(() => {
      ed.commands.setTextSelection(6);
    });
    let done!: Promise<void>;
    act(() => {
      done = ref.current!.insertFiles([new File([new Uint8Array(10)], 'a.png', { type: 'image/png' })]);
    });
    act(() => {
      ed.commands.setTextSelection({ from: 1, to: 3 });
    });
    await user.click(screen.getByRole('button', { name: '링크 연결' }));
    const input = screen.getByLabelText('주소');
    await user.type(input, 'example.com');
    await act(async () => {
      resolve('https://cdn.example.com/public/a.png');
      await done;
    });
    expect(input).toHaveFocus();
    await user.type(input, '{Enter}');
    expect(ref.current!.getHTML()).toMatch(/<a [^>]*href="https:\/\/example.com"[^>]*>안녕<\/a>/);
    expect(ref.current!.getHTML()).toContain('a.png');
  });
});

describe('입력 창 마무리', () => {
  it('오류 문구는 화면 낭독기가 바로 읽도록 alert 로 알린다', async () => {
    const { ed, user } = await setup();
    act(() => {
      ed.commands.selectAll();
    });
    await user.click(screen.getByRole('button', { name: '링크 연결' }));
    await user.type(screen.getByLabelText('주소'), 'javascript:x{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('http 또는 https 주소만 넣을 수 있습니다.');
  });

  it('창 크기가 바뀌면 위치를 다시 잡는다', async () => {
    const callbacks: Array<() => void> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          callbacks.push(cb);
        }
        observe() {}
        disconnect() {}
      },
    );
    let shift = 0;
    const original = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (!this.classList.contains('aikive-popover')) return original.call(this);
      return new DOMRect((Number.parseFloat(this.style.left) || 0) + shift, Number.parseFloat(this.style.top) || 0, 0, 0);
    });
    try {
      const { ed, user } = await setup();
      act(() => {
        ed.commands.selectAll();
      });
      await user.click(screen.getByRole('button', { name: '링크 연결' }));
      const dialog = screen.getByRole('dialog', { name: '링크' });
      expect(dialog.style.left).toBe('8px');
      shift = 30;
      act(() => callbacks.forEach((cb) => cb()));
      expect(dialog.style.left).toBe('-22px');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('편집 불가가 되면 창을 닫고, 다시 편집 가능해져도 저절로 뜨지 않는다', async () => {
    const ref = createRef<AikiveTextEditorHandle>();
    const { container, rerender } = render(<AikiveTextEditor ref={ref} initialContent="<p>안녕</p>" />);
    let ed: Editor | undefined;
    await waitFor(() => {
      ed = (container.querySelector('.ProseMirror') as unknown as { editor?: Editor } | null)?.editor;
      expect(ed).toBeTruthy();
    });
    act(() => {
      ed!.commands.selectAll();
    });
    await userEvent.setup().click(screen.getByRole('button', { name: '링크 연결' }));
    expect(screen.getByRole('dialog', { name: '링크' })).toBeInTheDocument();
    rerender(<AikiveTextEditor ref={ref} initialContent="<p>안녕</p>" editable={false} />);
    rerender(<AikiveTextEditor ref={ref} initialContent="<p>안녕</p>" editable />);
    expect(screen.queryByRole('dialog', { name: '링크' })).toBeNull();
  });
});

describe('입력 창이 열린 채 바뀌는 상황', () => {
  it.each(['restoreSnapshot', 'resetContent', 'setSourceMode'] as const)('%s 로 본문이 바뀌면 창을 닫아 다른 본문에 적용하지 않는다', async (how) => {
    const { ref, ed, user } = await setup({ initialContent: '<p>Tab B text here</p>' });
    const snapshotB = ref.current!.takeSnapshot()!;
    act(() => ref.current!.resetContent('<p>Tab A text</p>'));
    act(() => {
      ed.commands.setTextSelection({ from: 1, to: 4 });
    });
    await user.click(screen.getByRole('button', { name: '링크 연결' }));
    expect(screen.getByRole('dialog', { name: '링크' })).toBeInTheDocument();
    act(() => {
      if (how === 'restoreSnapshot') ref.current!.restoreSnapshot(snapshotB);
      else if (how === 'resetContent') ref.current!.resetContent('<p>Tab B text here</p>');
      else ref.current!.setSourceMode(true);
    });
    expect(screen.queryByRole('dialog', { name: '링크' })).toBeNull();
  });

  it('업로드가 끝난 뒤 Esc 로 닫아도 열 때의 선택으로 돌아간다', async () => {
    let resolve!: (url: string) => void;
    const upload = () => new Promise<string>((r) => (resolve = r));
    const { ref, ed, user } = await setup({ initialContent: '<p>안녕 세상</p>', onUploadImage: upload });
    act(() => {
      ed.commands.setTextSelection(6);
    });
    let done!: Promise<void>;
    act(() => {
      done = ref.current!.insertFiles([new File([new Uint8Array(10)], 'a.png', { type: 'image/png' })]);
    });
    act(() => {
      ed.commands.setTextSelection({ from: 1, to: 3 });
    });
    await user.click(screen.getByRole('button', { name: '링크 연결' }));
    await act(async () => {
      resolve('https://cdn.example.com/public/a.png');
      await done;
    });
    fireEvent.keyDown(screen.getByLabelText('주소'), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '링크' })).toBeNull();
    expect([ed.state.selection.from, ed.state.selection.to]).toEqual([1, 3]);
  });

  it('키보드로 창 밖으로 포커스가 나가면 닫고, 갈 곳 없는 blur(Safari 버튼 클릭)에는 닫지 않는다', async () => {
    const { ed, user } = await setup();
    act(() => {
      ed.commands.selectAll();
    });
    await user.click(screen.getByRole('button', { name: '링크 연결' }));
    const input = screen.getByLabelText('주소');
    fireEvent.blur(input, { relatedTarget: null });
    expect(screen.getByRole('dialog', { name: '링크' })).toBeInTheDocument();
    fireEvent.blur(input, { relatedTarget: screen.getByLabelText('새 탭에서 열기') });
    expect(screen.getByRole('dialog', { name: '링크' })).toBeInTheDocument();
    fireEvent.blur(input, { relatedTarget: ed.view.dom });
    expect(screen.queryByRole('dialog', { name: '링크' })).toBeNull();
  });
});
