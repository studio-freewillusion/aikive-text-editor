import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AikiveTextEditor } from '../src/editor';

describe('에디터 툴바 연결', () => {
  it('고정 툴바를 그리고 features 로 끈 버튼은 숨긴다', async () => {
    render(<AikiveTextEditor initialContent="<p>a</p>" features={{ sourceMode: false }} />);
    await waitFor(() => expect(screen.getByRole('toolbar', { name: '서식' })).toBeInTheDocument());
    expect(screen.queryByLabelText('HTML 모드')).toBeNull();
    expect(screen.getByLabelText('굵게')).toBeInTheDocument();
  });

  it('편집할 수 없으면 툴바를 그리지 않는다', async () => {
    const { container } = render(<AikiveTextEditor initialContent="<p>a</p>" editable={false} />);
    await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull());
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('이미지 넣기 버튼은 업로드 함수가 있을 때만 보이고 고른 파일을 올린다', async () => {
    const upload = vi.fn(async () => 'https://cdn.example.com/public/a.png');
    const { container, rerender } = render(<AikiveTextEditor initialContent="<p>a</p>" />);
    await waitFor(() => expect(screen.getByRole('toolbar')).toBeInTheDocument());
    expect(screen.queryByLabelText('이미지 넣기')).toBeNull();
    rerender(<AikiveTextEditor initialContent="<p>a</p>" onUploadImage={upload} />);
    expect(screen.getByLabelText('이미지 넣기')).toBeInTheDocument();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.accept).toBe('image/png,image/jpeg,image/gif,image/webp');
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([new Uint8Array(4)], 'a.png', { type: 'image/png' })] } });
    });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
  });

  it('HTML 모드 버튼으로 소스 편집을 켠다', async () => {
    const { container } = render(<AikiveTextEditor initialContent="<p>a</p>" />);
    await waitFor(() => expect(screen.getByLabelText('HTML 모드')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('HTML 모드'));
    expect(container.querySelector('textarea')).not.toBeNull();
  });
});
