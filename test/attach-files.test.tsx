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
});
