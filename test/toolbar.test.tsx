import { Editor } from '@tiptap/core';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FEATURES, type Features } from '../src/editor';
import { buildExtensions } from '../src/editor/use-editor-setup';
import { Toolbar } from '../src/ui/toolbar';

let editor: Editor;

function createEditor(content: string) {
  editor = new Editor({ element: document.createElement('div'), extensions: buildExtensions(true), content });
  editor.commands.selectAll();
  return editor;
}

function renderToolbar(opts: { features?: Required<Features>; onPickImage?: () => void; onNotice?: () => void } = {}) {
  return render(
    <Toolbar
      editor={editor}
      features={opts.features ?? DEFAULT_FEATURES}
      sourceMode={false}
      onToggleSource={() => {}}
      onPickImage={opts.onPickImage}
      onNotice={opts.onNotice ?? (() => {})}
    />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  editor?.destroy();
});

describe('Toolbar', () => {
  it('밑줄 버튼으로 밑줄을 넣는다', async () => {
    createEditor('<p>안녕</p>');
    renderToolbar();
    await userEvent.setup().click(screen.getByRole('button', { name: '밑줄' }));
    expect(editor.getHTML()).toContain('<u>');
  });

  it('글자 크기를 고르면 본문에 반영한다', async () => {
    createEditor('<p>안녕</p>');
    renderToolbar();
    await userEvent.setup().selectOptions(screen.getByLabelText('글자 크기'), '24px');
    expect(editor.getHTML()).toContain('font-size: 24px');
  });

  it('줄간격을 고르면 본문에 반영한다', async () => {
    createEditor('<p>안녕</p>');
    renderToolbar();
    await userEvent.setup().selectOptions(screen.getByLabelText('줄간격'), '1.5');
    expect(editor.getHTML()).toContain('line-height: 1.5');
  });

  it('글자색 프리셋을 고르면 본문에 반영한다', async () => {
    createEditor('<p>안녕</p>');
    renderToolbar();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '글자색' }));
    await user.click(screen.getByRole('button', { name: '글자색 빨강' }));
    expect(editor.getHTML()).toMatch(/color: (#dc2626|rgb\(220, 38, 38\))/);
  });

  it('같은 탭으로 열도록 고르면 target 을 넣지 않는다', async () => {
    createEditor('<p>안녕</p>');
    renderToolbar();
    vi.spyOn(window, 'prompt').mockReturnValue('https://example.com');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.setup().click(screen.getByRole('button', { name: '링크 연결' }));
    expect(editor.getHTML()).toContain('href="https://example.com"');
    expect(editor.getHTML()).not.toContain('target="_blank"');
  });

  it('넣을 수 없는 주소면 onNotice 로 안내한다', async () => {
    createEditor('<p>안녕</p>');
    const onNotice = vi.fn();
    renderToolbar({ onNotice });
    vi.spyOn(window, 'prompt').mockReturnValue('mailto:a@b.com');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.setup().click(screen.getByRole('button', { name: '링크 연결' }));
    expect(onNotice).toHaveBeenCalledWith(expect.stringContaining('http'), 'error');
  });

  it('표 삽입 버튼으로 표를 넣는다', async () => {
    createEditor('<p>안녕</p>');
    renderToolbar();
    await userEvent.setup().click(screen.getByRole('button', { name: '표 삽입' }));
    expect(editor.getHTML()).toContain('<table');
  });

  it('표 안에서 열을 추가한다', async () => {
    createEditor('<table><tbody><tr><td><p>A</p></td></tr></tbody></table>');
    editor.commands.setTextSelection(3);
    renderToolbar();
    await userEvent.setup().selectOptions(screen.getByLabelText('표 편집'), 'addColumnAfter');
    expect(editor.getHTML().match(/<td/g)).toHaveLength(2);
  });

  it.each([
    ['heading', '제목 1'],
    ['fontSize', '글자 크기'],
    ['color', '글자색'],
    ['lineHeight', '줄간격'],
    ['align', '왼쪽 정렬'],
    ['table', '표 삽입'],
    ['link', '링크 연결'],
    ['sourceMode', 'HTML 모드'],
    ['undoRedo', '되돌리기'],
  ] as const)('features.%s 를 끄면 「%s」 가 사라지고 켜면 보인다', (key, label) => {
    createEditor('<p>a</p>');
    const { unmount } = renderToolbar({ features: { ...DEFAULT_FEATURES, [key]: false } });
    expect(screen.queryByLabelText(label)).toBeNull();
    unmount();
    renderToolbar();
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('이미지 넣기는 onPickImage 가 있고 features.image 가 켜졌을 때만 보인다', () => {
    createEditor('<p>a</p>');
    const { unmount } = renderToolbar();
    expect(screen.queryByLabelText('이미지 넣기')).toBeNull();
    unmount();
    const r2 = renderToolbar({ onPickImage: () => {} });
    expect(screen.getByLabelText('이미지 넣기')).toBeInTheDocument();
    r2.unmount();
    renderToolbar({ onPickImage: () => {}, features: { ...DEFAULT_FEATURES, image: false } });
    expect(screen.queryByLabelText('이미지 넣기')).toBeNull();
  });

  it('글꼴 선택은 어떤 설정에서도 없다', () => {
    createEditor('<p>a</p>');
    renderToolbar();
    expect(screen.queryByLabelText('글꼴')).toBeNull();
  });
  it('이미지를 고르고 링크 연결을 누르면 이미지에 링크를 걸고 버튼이 활성으로 보인다', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce('example.com');
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    createEditor('<img src="https://cdn.example.com/a.png">');
    editor.commands.setNodeSelection(0);
    renderToolbar();
    await userEvent.setup().click(screen.getByRole('button', { name: '링크 연결' }));
    expect(editor.getHTML()).toContain('<a href="https://example.com" target="_blank"');
    expect(await screen.findByRole('button', { name: '링크 연결' })).toHaveClass('is-active');
  });

  it('이미지 링크를 같은 탭으로 다시 걸면 target 과 rel 이 남지 않는다', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce('https://example.com');
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    createEditor('<a href="https://example.com" target="_blank"><img src="https://cdn.example.com/a.png"></a>');
    editor.commands.setNodeSelection(0);
    renderToolbar();
    await userEvent.setup().click(screen.getByRole('button', { name: '링크 연결' }));
    expect(editor.getHTML()).toContain('<a href="https://example.com"');
    expect(editor.getHTML()).not.toMatch(/target=|rel=/);
  });

  it('이미지 링크 주소를 비우면 링크만 풀고 이미지는 남긴다', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce('');
    createEditor('<a href="https://example.com"><img src="https://cdn.example.com/a.png"></a>');
    editor.commands.setNodeSelection(0);
    renderToolbar();
    await userEvent.setup().click(screen.getByRole('button', { name: '링크 연결' }));
    expect(editor.getHTML()).not.toContain('<a');
    expect(editor.getHTML()).toContain('<img');
  });

  it('이미지에 http·https 가 아닌 주소를 넣으면 onNotice 로 안내한다', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce('javascript:alert(1)');
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    createEditor('<img src="https://cdn.example.com/a.png">');
    editor.commands.setNodeSelection(0);
    const onNotice = vi.fn();
    renderToolbar({ onNotice });
    await userEvent.setup().click(screen.getByRole('button', { name: '링크 연결' }));
    expect(onNotice).toHaveBeenCalledWith(expect.stringContaining('유효하지 않은 URL'), 'error');
    expect(editor.getHTML()).not.toContain('<a');
  });
  it('밀어서 넘기는 툴바는 더 넘길 쪽 끝을 흐리게 표시한다', () => {
    createEditor('<p>a</p>');
    render(
      <Toolbar
        editor={editor}
        features={DEFAULT_FEATURES}
        sourceMode={false}
        onToggleSource={() => {}}
        onNotice={() => {}}
        scrollable
      />,
    );
    const bar = screen.getByRole('toolbar');
    Object.defineProperty(bar, 'scrollWidth', { configurable: true, value: 500 });
    Object.defineProperty(bar, 'clientWidth', { configurable: true, value: 200 });
    const scrollTo = (left: number) => {
      bar.scrollLeft = left;
      fireEvent.scroll(bar);
    };
    scrollTo(0);
    expect(bar).toHaveClass('is-fade-end');
    expect(bar).not.toHaveClass('is-fade-start');
    scrollTo(150);
    expect(bar).toHaveClass('is-fade-start', 'is-fade-end');
    scrollTo(300);
    expect(bar).toHaveClass('is-fade-start');
    expect(bar).not.toHaveClass('is-fade-end');
  });
});
