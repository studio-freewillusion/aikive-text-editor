import { act, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { AikiveTextEditor, type AikiveTextEditorHandle, type AikiveTextEditorProps } from '../src/editor';

const png = (name: string, size = 10) => new File([new Uint8Array(size)], name, { type: 'image/png' });
const mp4 = () => new File([new Uint8Array(10)], 'clip.mp4', { type: 'video/mp4' });

const setup = async (upload?: (f: File) => Promise<string>, props: Partial<AikiveTextEditorProps> = {}) => {
  const ref = createRef<AikiveTextEditorHandle>();
  const onNotice = vi.fn();
  const { container } = render(<AikiveTextEditor ref={ref} onUploadImage={upload} onNotice={onNotice} {...props} />);
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

  it('올리는 동안 본문이 통째로 바뀌면 남은 파일은 넣지 않고 한 번 알린다', async () => {
    const resolves: Array<(url: string) => void> = [];
    const upload = vi.fn(() => new Promise<string>((r) => resolves.push(r)));
    const { ref, ed, onNotice } = await setup(upload);
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
    expect(ref.current!.getHTML()).toBe('<p>a</p>');
    expect(onNotice.mock.calls.filter(([m]) => m === '올리던 이미지는 넣지 않았습니다. 다시 첨부해 주세요.')).toHaveLength(1);
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

  const deferred = () => {
    let resolve!: (url: string) => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<string>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  it('올리는 동안 자리 표시를 보이고 HTML 에는 넣지 않는다', async () => {
    const d = deferred();
    const { ref, ed } = await setup(() => d.promise);
    let done!: Promise<void>;
    act(() => {
      done = ref.current!.insertFiles([png('a.png')]);
    });
    expect(ed.view.dom.querySelector('.aikive-upload-placeholder')).toHaveTextContent('이미지 올리는 중');
    expect(ref.current!.getHTML()).toBe('');
    await act(async () => {
      d.resolve('https://cdn.example.com/public/a.png');
      await done;
    });
    expect(ed.view.dom.querySelector('.aikive-upload-placeholder')).toBeNull();
    expect(ref.current!.getHTML()).toContain('a.png');
  });

  it('올리는 중 상태를 알리고, 실패한 파일은 자리 표시만 지운다', async () => {
    const a = deferred();
    const b = deferred();
    const onUploadingChange = vi.fn();
    const upload = vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { ref, ed, onNotice } = await setup(upload, { onUploadingChange });
    let done!: Promise<void>;
    act(() => {
      done = ref.current!.insertFiles([png('a.png'), png('b.png')]);
    });
    expect(ref.current!.isUploading()).toBe(true);
    expect(onUploadingChange.mock.calls).toEqual([[true]]);
    expect(ed.view.dom.querySelectorAll('.aikive-upload-placeholder')).toHaveLength(2);
    await act(async () => {
      a.reject(new Error('x'));
      await Promise.resolve();
      b.resolve('https://cdn.example.com/public/b.png');
      await done;
    });
    expect(onNotice).toHaveBeenCalledWith('a.png 업로드에 실패했습니다. 다시 시도해 주세요.', 'error');
    expect(ed.view.dom.querySelector('.aikive-upload-placeholder')).toBeNull();
    expect(ref.current!.getHTML()).toContain('b.png');
    expect(ref.current!.isUploading()).toBe(false);
    expect(onUploadingChange.mock.calls).toEqual([[true], [false]]);
  });

  // 빈 본문(빈 문단)에서 시작해야 첫 이미지가 문단을 통째로 바꾸는 경우를 지킨다
  it('여러 파일은 고른 순서대로 들어간다', async () => {
    const a = deferred();
    const b = deferred();
    const upload = vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { ref } = await setup(upload);
    let done!: Promise<void>;
    act(() => {
      done = ref.current!.insertFiles([png('a.png'), png('b.png')]);
    });
    await act(async () => {
      a.resolve('https://cdn.example.com/public/a.png');
      b.resolve('https://cdn.example.com/public/b.png');
      await done;
    });
    const html = ref.current!.getHTML();
    expect(html.indexOf('a.png')).toBeGreaterThan(-1);
    expect(html.indexOf('a.png')).toBeLessThan(html.indexOf('b.png'));
  });

  it.each(['restoreSnapshot', 'resetContent'] as const)('올리는 중 %s 로 본문이 바뀌면 끝나도 넣지 않고 한 번 알린다', async (how) => {
    const a = deferred();
    const b = deferred();
    const upload = vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { ref, onNotice } = await setup(upload);
    act(() => ref.current!.resetContent('<p>탭 B</p>'));
    const snapshotB = ref.current!.takeSnapshot()!;
    act(() => ref.current!.resetContent('<p>탭 A</p>'));
    let done!: Promise<void>;
    act(() => {
      done = ref.current!.insertFiles([png('a.png'), png('b.png')]);
    });
    act(() => {
      if (how === 'restoreSnapshot') ref.current!.restoreSnapshot(snapshotB);
      else ref.current!.resetContent('<p>탭 B</p>');
    });
    await act(async () => {
      a.resolve('https://cdn.example.com/public/a.png');
      b.resolve('https://cdn.example.com/public/b.png');
      await done;
    });
    expect(ref.current!.getHTML()).toBe('<p>탭 B</p>');
    expect(onNotice.mock.calls.filter(([m]) => m === '올리던 이미지는 넣지 않았습니다. 다시 첨부해 주세요.')).toHaveLength(1);
    expect(ref.current!.isUploading()).toBe(false);
  });

  it('올리는 중에는 HTML 모드로 들어가지 않는다', async () => {
    const d = deferred();
    const { ref } = await setup(() => d.promise);
    let done!: Promise<void>;
    act(() => {
      done = ref.current!.insertFiles([png('a.png')]);
    });
    expect(screen.getByRole('button', { name: 'HTML 모드' })).toBeDisabled();
    act(() => ref.current!.setSourceMode(true));
    expect(screen.queryByLabelText('HTML 소스')).toBeNull();
    await act(async () => {
      d.resolve('https://cdn.example.com/public/a.png');
      await done;
    });
    expect(screen.getByRole('button', { name: 'HTML 모드' })).not.toBeDisabled();
  });

  const flush = () => new Promise((r) => setTimeout(r, 0));
  const DROPPED = '올리던 이미지는 넣지 않았습니다. 다시 첨부해 주세요.';

  it('넣은 뒤 다른 본문으로 바뀌고 남은 업로드가 버려지면 그 본문을 건드리지 않는다', async () => {
    const a = deferred();
    const b = deferred();
    const upload = vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { ref, ed } = await setup(upload);
    act(() => ref.current!.resetContent('<p>Second tab text</p>'));
    const snapshotB = ref.current!.takeSnapshot()!;
    act(() => ref.current!.resetContent('<p>A</p>'));
    act(() => ed.commands.setTextSelection(2));
    let done!: Promise<void>;
    act(() => {
      done = ref.current!.insertFiles([png('a.png'), png('b.png')]);
    });
    await act(async () => {
      a.resolve('https://cdn.example.com/public/a.png');
      await flush();
    });
    act(() => ref.current!.restoreSnapshot(snapshotB));
    await act(async () => {
      b.resolve('https://cdn.example.com/public/b.png');
      await done;
    });
    expect(ref.current!.getHTML()).toBe('<p>Second tab text</p>');
  });

  it('버려진 업로드의 자리 표시는 예전 본문으로 돌아가도 남지 않는다', async () => {
    const d = deferred();
    const { ref, ed } = await setup(() => d.promise);
    act(() => ref.current!.resetContent('<p>탭 B</p>'));
    const snapshotB = ref.current!.takeSnapshot()!;
    act(() => ref.current!.resetContent('<p>탭 A</p>'));
    let done!: Promise<void>;
    act(() => {
      done = ref.current!.insertFiles([png('a.png')]);
    });
    const snapshotA = ref.current!.takeSnapshot()!;
    act(() => ref.current!.restoreSnapshot(snapshotB));
    await act(async () => {
      d.resolve('https://cdn.example.com/public/a.png');
      await done;
    });
    act(() => ref.current!.restoreSnapshot(snapshotA));
    expect(ed.view.dom.querySelector('.aikive-upload-placeholder')).toBeNull();
  });

  it('올리는 중에 본문을 오갔다 돌아오면 그 본문에 이미지를 넣는다', async () => {
    const d = deferred();
    const { ref, ed } = await setup(() => d.promise);
    act(() => ref.current!.resetContent('<p>탭 B</p>'));
    const snapshotB = ref.current!.takeSnapshot()!;
    act(() => ref.current!.resetContent('<p>탭 A</p>'));
    act(() => ed.commands.setTextSelection(4));
    let done!: Promise<void>;
    act(() => {
      done = ref.current!.insertFiles([png('a.png')]);
    });
    const snapshotA = ref.current!.takeSnapshot()!;
    act(() => ref.current!.restoreSnapshot(snapshotB));
    act(() => ref.current!.restoreSnapshot(snapshotA));
    expect(ed.view.dom.querySelectorAll('.aikive-upload-placeholder')).toHaveLength(1);
    await act(async () => {
      d.resolve('https://cdn.example.com/public/a.png');
      await done;
    });
    expect(ref.current!.getHTML()).toContain('탭 A');
    expect(ref.current!.getHTML()).toContain('a.png');
  });

  it('올리는 중에 또 고른 이미지도 같은 빈 문단에서 빠지지 않는다', async () => {
    const a = deferred();
    const b = deferred();
    const upload = vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { ref, onNotice } = await setup(upload);
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = ref.current!.insertFiles([png('a.png')]);
    });
    act(() => {
      second = ref.current!.insertFiles([png('b.png')]);
    });
    await act(async () => {
      a.resolve('https://cdn.example.com/public/a.png');
      await first;
      b.resolve('https://cdn.example.com/public/b.png');
      await second;
    });
    expect(ref.current!.getHTML()).toContain('a.png');
    expect(ref.current!.getHTML()).toContain('b.png');
    expect(onNotice.mock.calls.filter(([m]) => m === DROPPED)).toHaveLength(0);
  });

  it('넣은 뒤 커서를 옮기고 다음 파일이 실패해도 그 문단을 쪼개지 않는다', async () => {
    const a = deferred();
    const b = deferred();
    const upload = vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { ref, ed } = await setup(upload);
    act(() => ref.current!.resetContent('<p>abcdef</p>'));
    act(() => ed.commands.setTextSelection(7));
    let done!: Promise<void>;
    act(() => {
      done = ref.current!.insertFiles([png('a.png'), png('b.png')]);
    });
    await act(async () => {
      a.resolve('https://cdn.example.com/public/a.png');
      await flush();
    });
    act(() => ed.commands.setTextSelection(4));
    await act(async () => {
      b.reject(new Error('x'));
      await done;
    });
    expect(ref.current!.getHTML()).toContain('<p>abcdef</p>');
    expect(ref.current!.getHTML()).toContain('a.png');
  });

  it('글 끝에 올린 뒤 커서는 새 문단에 있어 이어 쓰면 이미지가 남는다', async () => {
    const d = deferred();
    const { ref, ed } = await setup(() => d.promise);
    act(() => ref.current!.resetContent('<p>hello</p>'));
    act(() => ed.commands.setTextSelection(6));
    let done!: Promise<void>;
    act(() => {
      done = ref.current!.insertFiles([png('a.png')]);
    });
    await act(async () => {
      d.resolve('https://cdn.example.com/public/a.png');
      await done;
    });
    expect(ed.state.selection).toBeInstanceOf(TextSelection);
    act(() => {
      ed.commands.insertContent('x');
    });
    expect(ref.current!.getHTML()).toContain('a.png');
    expect(ref.current!.getHTML()).toContain('<p>x</p>');
  });
});
