import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { AikiveTextEditor, type AikiveTextEditorHandle } from '../src/editor';

const editorOf = async (container: HTMLElement) => {
  let ed: Editor | undefined;
  await waitFor(() => {
    ed = (container.querySelector('.ProseMirror') as unknown as { editor?: Editor } | null)?.editor;
    expect(ed).toBeTruthy();
  });
  return ed!;
};
// 되돌리기는 0.5초 안 입력을 한 묶음으로 합친다
const pause = () => act(() => new Promise((r) => setTimeout(r, 600)));

describe('AikiveTextEditor', () => {
  it('빈 에디터의 onChange 값은 빈 문자열', async () => {
    const onChange = vi.fn();
    const { container } = render(<AikiveTextEditor initialContent="<p>a</p>" onChange={onChange} />);
    const ed = await editorOf(container);
    act(() => {
      ed.commands.clearContent(true);
    });
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('HTML 과 옛 JSON 을 모두 불러온다', async () => {
    const ref = createRef<AikiveTextEditorHandle>();
    const json = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '옛' }] }] });
    render(<AikiveTextEditor ref={ref} initialContent={json} />);
    await waitFor(() => expect(ref.current?.getHTML()).toBe('<p>옛</p>'));
    act(() => ref.current!.resetContent('<p>새</p>'));
    expect(ref.current!.getHTML()).toBe('<p>새</p>');
  });

  it('resetContent 는 onChange 를 부르지 않고 되돌리기 기록을 새로 시작한다', async () => {
    const onChange = vi.fn();
    const ref = createRef<AikiveTextEditorHandle>();
    const { container } = render(<AikiveTextEditor ref={ref} initialContent="<p>가</p>" onChange={onChange} />);
    const ed = await editorOf(container);
    act(() => {
      ed.commands.insertContentAt(ed.state.doc.content.size - 1, '나');
    });
    await pause();
    onChange.mockClear();
    act(() => ref.current!.resetContent('<p>a</p>'));
    expect(onChange).not.toHaveBeenCalled();
    await pause();
    act(() => {
      ed.commands.undo();
    });
    expect(ref.current!.getHTML()).toBe('<p>a</p>');
  });

  it('스냅샷을 되살리면 그 내용의 편집만 되돌린다', async () => {
    const ref = createRef<AikiveTextEditorHandle>();
    const { container } = render(<AikiveTextEditor ref={ref} initialContent="<p>가</p>" />);
    const ed = await editorOf(container);
    act(() => {
      ed.commands.insertContentAt(ed.state.doc.content.size - 1, '나');
    });
    await pause();
    const ko = ref.current!.takeSnapshot()!;
    act(() => ref.current!.resetContent('<p>a</p>'));
    await pause();
    act(() => {
      ed.commands.undo();
    });
    expect(ref.current!.getHTML()).toBe('<p>a</p>');
    act(() => {
      expect(ref.current!.restoreSnapshot(ko)).toBe(true);
    });
    expect(ref.current!.getHTML()).toBe('<p>가나</p>');
    await pause();
    act(() => {
      ed.commands.undo();
    });
    expect(ref.current!.getHTML()).toBe('<p>가</p>');
  });

  it('글꼴·링크 꾸밈은 불러와 저장해도 그대로 남는다', async () => {
    const ref = createRef<AikiveTextEditorHandle>();
    const html =
      '<p><span style="font-family: Pretendard">글꼴</span><a target="_blank" rel="noopener noreferrer nofollow" href="https://a.example.com" style="padding: 4px">버튼</a></p>';
    render(<AikiveTextEditor ref={ref} initialContent={html} />);
    await waitFor(() => expect(ref.current?.getHTML()).toContain('font-family: Pretendard'));
    expect(ref.current!.getHTML()).toMatch(/style="padding: 4px;?"/);
  });

  it('htmlClassNames 를 넘기면 유튜브 iframe 출력에 그 class 를 붙인다', async () => {
    const ref = createRef<AikiveTextEditorHandle>();
    const yt = '<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe></div>';
    const { rerender } = render(<AikiveTextEditor ref={ref} initialContent={yt} htmlClassNames={{ youtube: 'tiptap-youtube' }} />);
    await waitFor(() => expect(ref.current?.getHTML()).toContain('class="tiptap-youtube"'));
    rerender(<AikiveTextEditor key="b" ref={ref} initialContent={yt} />);
    await waitFor(() => expect(ref.current?.getHTML()).not.toContain('class='));
  });

  it('HTML 모드로 고친 내용을 돌아올 때 에디터에 반영한다', async () => {
    const ref = createRef<AikiveTextEditorHandle>();
    const { container } = render(<AikiveTextEditor ref={ref} initialContent="<p>a</p>" features={{ sourceMode: true }} />);
    await editorOf(container);
    act(() => ref.current!.setSourceMode(true));
    const textarea = container.querySelector('textarea')!;
    expect(textarea.value).toBe('<p>a</p>');
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(textarea, { target: { value: '<p>b</p>' } });
    act(() => ref.current!.setSourceMode(false));
    await waitFor(() => expect(ref.current!.getHTML()).toBe('<p>b</p>'));
  });
  it('스냅샷을 되살려도 그 뒤에 붙은 플러그인은 그대로 남는다', async () => {
    const ref = createRef<AikiveTextEditorHandle>();
    const { container } = render(<AikiveTextEditor ref={ref} initialContent="<p>가</p>" />);
    const ed = await editorOf(container);
    const snap = ref.current!.takeSnapshot()!;
    const key = new PluginKey('later');
    act(() => {
      ed.registerPlugin(new Plugin({ key }));
    });
    act(() => {
      ref.current!.restoreSnapshot(snap);
    });
    expect(key.get(ed.state)).toBeTruthy();
  });

  it('editable 이 바뀌면 에디터도 따라 바뀐다', async () => {
    const { container, rerender } = render(<AikiveTextEditor initialContent="<p>a</p>" editable={false} />);
    const ed = await editorOf(container);
    expect(ed.isEditable).toBe(false);
    rerender(<AikiveTextEditor initialContent="<p>a</p>" editable />);
    await waitFor(() => expect(ed.isEditable).toBe(true));
  });

  it('저장된 영상 블록을 불러와 저장해도 주소가 남는다', async () => {
    const ref = createRef<AikiveTextEditorHandle>();
    const saved =
      '<div data-type="videoBlock"><video src="https://cdn.example.com/a.mp4" poster="https://cdn.example.com/a.jpg" controls="" loop=""></video></div>';
    render(<AikiveTextEditor ref={ref} initialContent={saved} />);
    await waitFor(() => expect(ref.current?.getHTML()).toContain('src="https://cdn.example.com/a.mp4"'));
    const out = ref.current!.getHTML();
    expect(out).toContain('poster="https://cdn.example.com/a.jpg"');
    expect(out).toContain('loop=""');
  });
  it('HTML 모드가 실제로 바뀔 때만 onSourceModeChange 로 알린다', async () => {
    const onSourceModeChange = vi.fn();
    const ref = createRef<AikiveTextEditorHandle>();
    render(<AikiveTextEditor ref={ref} initialContent="<p>a</p>" onSourceModeChange={onSourceModeChange} />);
    await waitFor(() => expect(ref.current?.getHTML()).toBe('<p>a</p>'));
    act(() => {
      ref.current!.setSourceMode(true);
      ref.current!.setSourceMode(true);
    });
    expect(onSourceModeChange.mock.calls).toEqual([[true]]);
    act(() => ref.current!.setSourceMode(false));
    expect(onSourceModeChange.mock.calls).toEqual([[true], [false]]);
    act(() => ref.current!.setSourceMode(true));
    act(() => ref.current!.resetContent('<p>b</p>'));
    expect(onSourceModeChange.mock.calls).toEqual([[true], [false], [true]]);
    act(() => ref.current!.setSourceMode(true));
    expect(onSourceModeChange.mock.calls).toEqual([[true], [false], [true], [true]]);
  });

  it('같은 tick 에 HTML 모드를 켰다 끄면 본문은 그대로다', async () => {
    const onSourceModeChange = vi.fn();
    const ref = createRef<AikiveTextEditorHandle>();
    render(<AikiveTextEditor ref={ref} initialContent="<p>a</p>" onSourceModeChange={onSourceModeChange} />);
    await waitFor(() => expect(ref.current?.getHTML()).toBe('<p>a</p>'));
    act(() => {
      ref.current!.setSourceMode(true);
      ref.current!.setSourceMode(false);
    });
    expect(ref.current!.getHTML()).toBe('<p>a</p>');
    expect(onSourceModeChange.mock.calls).toEqual([[true], [false]]);
  });

  it('HTML 모드에서 글자색·유튜브·모르는 태그가 있어도 적용하고 Text 로 돌아온다', async () => {
    const onSourceModeChange = vi.fn();
    const onNotice = vi.fn();
    const ref = createRef<AikiveTextEditorHandle>();
    render(
      <AikiveTextEditor ref={ref} initialContent="<p>a</p>" onSourceModeChange={onSourceModeChange} onNotice={onNotice} />,
    );
    await waitFor(() => expect(ref.current?.getHTML()).toBe('<p>a</p>'));
    act(() => ref.current!.setSourceMode(true));
    const html =
      '<p><span style="color: rgb(220, 38, 38);">빨강</span></p>' +
      '<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID"></iframe></div>' +
      '<custom-x>모르는 태그</custom-x>';
    fireEvent.change(screen.getByLabelText('HTML 소스'), { target: { value: html } });
    act(() => ref.current!.setSourceMode(false));
    expect(onNotice).not.toHaveBeenCalled();
    expect(onSourceModeChange).toHaveBeenLastCalledWith(false);
    const out = ref.current!.getHTML();
    expect(out).toContain('<span style="color: rgb(220, 38, 38);">빨강</span>');
    expect(out).toContain('src="https://www.youtube-nocookie.com/embed/VIDEO_ID"');
    expect(out).toContain('모르는 태그');
  });
});
