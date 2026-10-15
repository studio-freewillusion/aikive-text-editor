import { Editor } from '@tiptap/core';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FEATURES, type ColorOption, type Features } from '../src/editor';
import { buildExtensions } from '../src/editor/use-editor-setup';
import { Toolbar } from '../src/ui/toolbar';

let editor: Editor;

function createEditor(content: string) {
  editor = new Editor({ element: document.createElement('div'), extensions: buildExtensions(true), content });
  editor.commands.selectAll();
  return editor;
}

function renderToolbar(
  opts: { features?: Required<Features>; onPickImage?: () => void; onOpenPopover?: (kind: string) => void; colors?: ColorOption[] } = {},
) {
  return render(
    <Toolbar
      editor={editor}
      features={opts.features ?? DEFAULT_FEATURES}
      sourceMode={false}
      onToggleSource={() => {}}
      onPickImage={opts.onPickImage}
      onOpenPopover={opts.onOpenPopover ?? (() => {})}
      colors={opts.colors}
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




  it('표 안에서 열을 추가한다', async () => {
    createEditor('<table><tbody><tr><td><p>A</p></td></tr></tbody></table>');
    editor.commands.setTextSelection(3);
    renderToolbar();
    await userEvent.setup().selectOptions(screen.getByLabelText('표 편집'), 'addColumnAfter');
    expect(editor.getHTML().match(/<td/g)).toHaveLength(2);
  });



  it('글꼴 선택은 어떤 설정에서도 없다', () => {
    createEditor('<p>a</p>');
    renderToolbar();
    expect(screen.queryByLabelText('글꼴')).toBeNull();
  });



  it('밀어서 넘기는 툴바는 더 넘길 쪽 끝을 흐리게 표시한다', () => {
    createEditor('<p>a</p>');
    render(
      <Toolbar
        editor={editor}
        features={DEFAULT_FEATURES}
        sourceMode={false}
        onToggleSource={() => {}}
        onOpenPopover={() => {}}
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

  it('글자와 링크 걸린 이미지를 함께 고르면 링크 버튼을 활성으로 보이지 않는다', () => {
    createEditor('<p>글</p><a href="https://example.com"><img src="https://cdn.example.com/a.png"></a>');
    renderToolbar();
    expect(screen.getByRole('button', { name: '링크 연결' })).not.toHaveClass('is-active');
  });

  it('링크 연결을 누르면 링크 창을 연다', async () => {
    createEditor('<p>안녕</p>');
    const onOpenPopover = vi.fn();
    renderToolbar({ onOpenPopover });
    await userEvent.setup().click(screen.getByRole('button', { name: '링크 연결' }));
    expect(onOpenPopover).toHaveBeenCalledWith('link');
  });

  it('링크가 걸린 이미지를 고르면 링크 연결 버튼이 활성으로 보인다', () => {
    createEditor('<a href="https://example.com"><img src="https://cdn.example.com/a.png"></a>');
    editor.commands.setNodeSelection(0);
    renderToolbar();
    expect(screen.getByRole('button', { name: '링크 연결' })).toHaveClass('is-active');
  });




  it('colors 를 넘기면 그 색들로 팔레트를 만든다', async () => {
    createEditor('<p>안녕</p>');
    renderToolbar({ colors: [{ label: '하양', value: '#ffffff' }] });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '글자색' }));
    expect(screen.queryByRole('button', { name: '글자색 빨강' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '글자색 하양' }));
    expect(editor.getHTML()).toMatch(/color: (#ffffff|rgb\(255, 255, 255\))/);
    expect(screen.getByRole('button', { name: '글자색 기본' })).toBeInTheDocument();
    expect(screen.getByLabelText('글자색 직접 고르기')).toBeInTheDocument();
  });

  const optionValues = (label: string) =>
    Array.from((screen.getByLabelText(label) as HTMLSelectElement).options).map((o) => o.value);

  it.each([
    ['fontSize', '글자 크기'],
    ['color', '글자색'],
    ['lineHeight', '줄간격'],
    ['align', '정렬'],
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

  it('문단 종류는 켜진 기능의 항목만 두고, 모두 끄면 사라진다', () => {
    createEditor('<p>a</p>');
    const { unmount } = renderToolbar();
    expect(optionValues('문단 종류')).toEqual(['paragraph', 'h1', 'h2', 'h3', 'bullet', 'ordered', 'quote', 'code']);
    unmount();
    const r2 = renderToolbar({ features: { ...DEFAULT_FEATURES, heading: false, blocks: false } });
    expect(optionValues('문단 종류')).toEqual(['paragraph', 'bullet', 'ordered']);
    r2.unmount();
    renderToolbar({ features: { ...DEFAULT_FEATURES, heading: false, list: false, blocks: false } });
    expect(screen.queryByLabelText('문단 종류')).toBeNull();
  });

  it.each([
    ['h2', /<h2>안녕<\/h2>/],
    ['bullet', /<ul><li><p>안녕<\/p><\/li><\/ul>/],
    ['ordered', /<ol><li><p>안녕<\/p><\/li><\/ol>/],
    ['quote', /<blockquote><p>안녕<\/p><\/blockquote>/],
    ['code', /<pre><code>안녕<\/code><\/pre>/],
  ])('문단 종류에서 %s 를 고르면 그 블록으로 바꾸고 선택 상자가 지금 종류를 보인다', async (value, html) => {
    createEditor('<p>안녕</p>').commands.setTextSelection(2);
    renderToolbar();
    await userEvent.setup().selectOptions(screen.getByLabelText('문단 종류'), value);
    expect(editor.getHTML()).toMatch(html);
    expect(screen.getByLabelText('문단 종류')).toHaveValue(value);
  });

  it.each([
    ['<h3>안녕</h3>', 2, 'h3'],
    ['<ul><li><p>안녕</p></li></ul>', 4, 'bullet'],
    ['<blockquote><p>안녕</p></blockquote>', 3, 'quote'],
  ])('%s 에서 본문을 고르면 문단으로 되돌린다', async (content, pos, current) => {
    createEditor(content);
    editor.commands.setTextSelection(pos);
    renderToolbar();
    expect(screen.getByLabelText('문단 종류')).toHaveValue(current);
    await userEvent.setup().selectOptions(screen.getByLabelText('문단 종류'), 'paragraph');
    // 편집 중에는 끝에 빈 문단이 덧붙으므로 앞부분만 본다
    expect(editor.getHTML()).toMatch(/^<p>안녕<\/p>(<p><\/p>)?$/);
  });

  it('정렬을 고르면 반영하고 지금 정렬을 보인다', async () => {
    createEditor('<p>안녕</p>').commands.setTextSelection(2);
    renderToolbar();
    expect(screen.getByLabelText('정렬')).toHaveValue('');
    await userEvent.setup().selectOptions(screen.getByLabelText('정렬'), 'center');
    expect(editor.getHTML()).toContain('text-align: center');
    expect(screen.getByLabelText('정렬')).toHaveValue('center');
  });

  it('넣기는 켜진 기능만 두고, 넣은 뒤 「넣기」 로 돌아간다', async () => {
    createEditor('<p>안녕</p>').commands.setTextSelection(3);
    const onOpenPopover = vi.fn();
    const onPickImage = vi.fn();
    renderToolbar({ onOpenPopover, onPickImage });
    expect(optionValues('넣기')).toEqual(['', 'table', 'hr', 'youtube', 'image']);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('넣기'), 'hr');
    expect(editor.getHTML()).toContain('<hr>');
    expect(screen.getByLabelText('넣기')).toHaveValue('');
    await user.selectOptions(screen.getByLabelText('넣기'), 'youtube');
    expect(onOpenPopover).toHaveBeenCalledWith('youtube');
    await user.selectOptions(screen.getByLabelText('넣기'), 'image');
    expect(onPickImage).toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText('넣기'), 'table');
    expect(editor.getHTML()).toContain('<table');
  });

  it('넣기 항목은 기능 설정을 따르고, 모두 꺼지면 사라진다', () => {
    createEditor('<p>a</p>');
    const { unmount } = renderToolbar({ features: { ...DEFAULT_FEATURES, image: false } });
    expect(optionValues('넣기')).toEqual(['', 'table', 'hr', 'youtube']);
    unmount();
    renderToolbar({ features: { ...DEFAULT_FEATURES, table: false, blocks: false, youtube: false } });
    expect(screen.queryByLabelText('넣기')).toBeNull();
  });

  it('표 안에서는 넣기에 표가 없다', () => {
    createEditor('<table><tbody><tr><td><p>A</p></td></tr></tbody></table>');
    editor.commands.setTextSelection(3);
    renderToolbar();
    expect(optionValues('넣기')).not.toContain('table');
  });

  it('글자색 팔레트는 밀어서 넘기는 툴바 영역 밖에 그려 잘리지 않는다', async () => {
    createEditor('<p>안녕</p>');
    renderToolbar();
    await userEvent.setup().click(screen.getByRole('button', { name: '글자색' }));
    const palette = screen.getByRole('button', { name: '글자색 빨강' }).closest('.aikive-toolbar__palette')!;
    expect(screen.getByRole('toolbar').contains(palette)).toBe(false);
  });
});

describe('글자색 팔레트 위치', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    editor?.destroy();
  });

  it('툴바 상자 오른쪽 끝을 넘지 않게 왼쪽으로 당긴다', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('aikive-toolbar-wrap') ? 300 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('aikive-toolbar__palette') ? 160 : 0;
    });
    const rect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('aria-label') === '글자색') return new DOMRect(250, 0, 28, 28);
      return rect.call(this);
    });
    createEditor('<p>안녕</p>');
    renderToolbar();
    await userEvent.setup().click(screen.getByRole('button', { name: '글자색' }));
    const palette = screen.getByRole('button', { name: '글자색 빨강' }).closest<HTMLElement>('.aikive-toolbar__palette')!;
    expect(palette.style.left).toBe('140px');
  });
});

describe('문단 종류 바꾸기 경계', () => {
  afterEach(() => editor?.destroy());

  const cursorAt = (text: string) => {
    let found = -1;
    editor.state.doc.descendants((node, pos) => {
      if (found < 0 && node.isText && node.text?.includes(text)) found = pos + 1;
    });
    editor.commands.setTextSelection(found);
  };

  it.each([
    ['paragraph', '<p>line1<br>line2</p>'],
    ['bullet', '<ul><li><p>line1<br>line2</p></li></ul>'],
  ])('코드 블록을 %s 로 바꿔도 줄바꿈이 <br> 로 남는다', async (value, expected) => {
    createEditor('<pre><code>line1\nline2</code></pre>');
    cursorAt('line1');
    renderToolbar();
    await userEvent.setup().selectOptions(screen.getByLabelText('문단 종류'), value);
    expect(editor.getHTML()).toContain(expected);
  });

  it('목록 가운데 항목에서 번호 목록으로 바꾸면 목록 전체가 그 자리에서 바뀐다', async () => {
    createEditor('<ul><li><p>b1</p></li><li><p>b2</p></li><li><p>b3</p></li></ul>');
    cursorAt('b2');
    renderToolbar();
    await userEvent.setup().selectOptions(screen.getByLabelText('문단 종류'), 'ordered');
    expect(editor.getHTML()).toMatch(/^<ol><li><p>b1<\/p><\/li><li><p>b2<\/p><\/li><li><p>b3<\/p><\/li><\/ol>/);
  });

  it('하위 목록에서 바꾸면 그 하위 목록만 바뀌고 들여쓰기는 남는다', async () => {
    createEditor('<ul><li><p>a</p><ul><li><p>n2</p></li></ul></li></ul>');
    cursorAt('n2');
    renderToolbar();
    await userEvent.setup().selectOptions(screen.getByLabelText('문단 종류'), 'ordered');
    expect(editor.getHTML()).toMatch(/^<ul><li><p>a<\/p><ol><li><p>n2<\/p><\/li><\/ol><\/li><\/ul>/);
  });

  it('코드 블록과 다른 블록을 같이 골라 인용으로 바꿔도 줄바꿈이 남는다', async () => {
    createEditor('<p>pp</p><pre><code>line1\nline2</code></pre>');
    editor.commands.setTextSelection({ from: 2, to: 8 });
    renderToolbar();
    await userEvent.setup().selectOptions(screen.getByLabelText('문단 종류'), 'quote');
    expect(editor.getHTML()).toContain('line1<br>line2');
  });

  it('글머리 목록 안 번호 하위 목록은 번호 목록으로 보이고, 글머리로 바꾸면 그 하위 목록만 바뀐다', async () => {
    createEditor('<ul><li><p>n1</p><ol><li><p>n2</p></li></ol></li></ul>');
    cursorAt('n2');
    renderToolbar();
    expect(screen.getByLabelText('문단 종류')).toHaveValue('ordered');
    await userEvent.setup().selectOptions(screen.getByLabelText('문단 종류'), 'bullet');
    expect(editor.getHTML()).toMatch(/^<ul><li><p>n1<\/p><ul><li><p>n2<\/p><\/li><\/ul><\/li><\/ul>/);
    expect(screen.getByLabelText('문단 종류')).toHaveValue('bullet');
  });
});
