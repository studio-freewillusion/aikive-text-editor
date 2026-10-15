import { act, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import { AikiveTextEditor, type AikiveTextEditorHandle } from '../src/editor';

const png = (name: string, size = 10) => new File([new Uint8Array(size)], name, { type: 'image/png' });
const mp4 = () => new File([new Uint8Array(10)], 'clip.mp4', { type: 'video/mp4' });

const setup = async (upload?: (f: File) => Promise<string>) => {
  const ref = createRef<AikiveTextEditorHandle>();
  const onNotice = vi.fn();
  const { container } = render(<AikiveTextEditor ref={ref} onUploadImage={upload} onNotice={onNotice} />);
  let ed: Editor | undefined;
  await waitFor(() => {
    ed = (container.querySelector('.ProseMirror') as unknown as { editor?: Editor } | null)?.editor;
    expect(ed).toBeTruthy();
  });
  return { ref, onNotice, ed: ed! };
};

describe('파일 넣기', () => {
  it('영상은 빼고 안내하며 이미지는 올린다', async () => {
    const upload = vi.fn(async () => 'https://cdn.example.com/public/a.png');
    const { ref, onNotice } = await setup(upload);
    await act(() => ref.current!.insertFiles([mp4(), png('a.png')]));
    expect(onNotice).toHaveBeenCalledWith('영상 파일은 첨부할 수 없습니다.', 'info');
    expect(upload).toHaveBeenCalledTimes(1);
    expect(ref.current!.getHTML()).toContain('https://cdn.example.com/public/a.png');
  });

  it('10MB 넘는 이미지만 빼고 나머지는 올린다', async () => {
    const upload = vi.fn(async (f: File) => `https://cdn.example.com/public/${f.name}`);
    const { ref, onNotice } = await setup(upload);
    await act(() => ref.current!.insertFiles([png('big.png', 10 * 1024 * 1024 + 1), png('ok.png')]));
    expect(onNotice).toHaveBeenCalledWith('이미지 파일은 10MB 이하의 파일만 등록이 가능합니다.', 'info');
    expect(upload).toHaveBeenCalledTimes(1);
    expect(ref.current!.getHTML()).toContain('ok.png');
  });

  it('업로드가 실패하면 파일 이름으로 알리고 넣지 않는다', async () => {
    const { ref, onNotice } = await setup(async () => {
      throw new Error('x');
    });
    await act(() => ref.current!.insertFiles([png('fail.png')]));
    expect(onNotice).toHaveBeenCalledWith('fail.png 업로드에 실패했습니다. 다시 시도해 주세요.', 'error');
    expect(ref.current!.getHTML()).toBe('');
  });

  it('업로드 함수가 없으면 아무것도 하지 않는다', async () => {
    const { ref, onNotice } = await setup(undefined);
    await act(() => ref.current!.insertFiles([png('a.png')]));
    expect(onNotice).not.toHaveBeenCalled();
    expect(ref.current!.getHTML()).toBe('');
  });

  it('붙여넣은 HTML 속 video 는 새로 들어오지 않는다', async () => {
    const { ref, ed } = await setup(async () => '');
    act(() => {
      ed.view.pasteHTML('<p>글</p><video src="https://cdn.example.com/a.mp4"></video>');
    });
    expect(ref.current!.getHTML()).not.toContain('<video');
    expect(ref.current!.getHTML()).toContain('글');
  });
  it('영상 파일을 여러 개 넣어도 안내는 한 번만 띄운다', async () => {
    const upload = vi.fn(async () => 'https://cdn.example.com/public/a.png');
    const { ref, onNotice } = await setup(upload);
    await act(() => ref.current!.insertFiles([mp4(), mp4(), png('a.png')]));
    expect(onNotice.mock.calls.filter(([m]) => m === '영상 파일은 첨부할 수 없습니다.')).toHaveLength(1);
  });

  it('올리는 동안 앞에 글을 더 써도 이미지는 원래 자리 뒤에 들어간다', async () => {
    let resolve!: (url: string) => void;
    const upload = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const { ref, ed } = await setup(upload);
    act(() => ref.current!.resetContent('<p>ab</p>'));
    act(() => ed.commands.setTextSelection(3));
    let done!: Promise<void>;
    act(() => {
      done = ref.current!.insertFiles([png('a.png')]);
    });
    await act(async () => {
      ed.commands.insertContentAt(1, 'XYZ');
    });
    await act(async () => {
      resolve('https://cdn.example.com/public/a.png');
      await done;
    });
    expect(ref.current!.getHTML()).toMatch(/^<p>XYZab<\/p><img src="https:\/\/cdn.example.com\/public\/a.png"/);
  });

  it('올리는 동안 문서가 줄어도 남은 파일까지 넣는다', async () => {
    const resolves: Array<(url: string) => void> = [];
    const upload = vi.fn(() => new Promise<string>((r) => resolves.push(r)));
    const { ref, ed } = await setup(upload);
    act(() => ref.current!.resetContent('<p>abcdefgh</p>'));
    act(() => ed.commands.setTextSelection(9));
    let done!: Promise<void>;
    act(() => {
      done = ref.current!.insertFiles([png('a.png'), png('b.png')]);
    });
    await act(async () => {
      ed.commands.setContent('<p>a</p>');
      resolves[0]('https://cdn.example.com/public/a.png');
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      resolves[1]('https://cdn.example.com/public/b.png');
      await done;
    });
    const html = ref.current!.getHTML();
    expect(html).toContain('public/a.png');
    expect(html).toContain('public/b.png');
  });
  it('올리는 동안 에디터가 사라져도 오류 없이 끝난다', async () => {
    let resolve!: (url: string) => void;
    const upload = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const { ref, ed } = await setup(upload);
    let done!: Promise<void>;
    act(() => {
      done = ref.current!.insertFiles([png('a.png')]);
    });
    ed.destroy();
    resolve('https://cdn.example.com/public/a.png');
    await expect(done).resolves.toBeUndefined();
  });
});
