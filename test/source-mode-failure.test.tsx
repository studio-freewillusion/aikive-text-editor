import { act, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { expect, it, vi } from 'vitest';

vi.mock('../src/editor/source-mode', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/editor/source-mode')>()),
  applySourceContent: () => {
    throw new Error('읽을 수 없는 HTML');
  },
}));

import { AikiveTextEditor, type AikiveTextEditorHandle } from '../src/editor';

it('HTML 을 적용하지 못하면 안내하고 HTML 모드에 머물며 모드 변경을 알리지 않는다', async () => {
  const onSourceModeChange = vi.fn();
  const onNotice = vi.fn();
  const ref = createRef<AikiveTextEditorHandle>();
  render(<AikiveTextEditor ref={ref} initialContent="<p>a</p>" onSourceModeChange={onSourceModeChange} onNotice={onNotice} />);
  await waitFor(() => expect(ref.current?.getHTML()).toBe('<p>a</p>'));
  act(() => ref.current!.setSourceMode(true));
  act(() => ref.current!.setSourceMode(false));
  expect(onNotice).toHaveBeenCalledWith(expect.any(String), 'error');
  expect(onSourceModeChange.mock.calls).toEqual([[true]]);
});
