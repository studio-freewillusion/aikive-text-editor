import { afterEach, describe, expect, it, vi } from 'vitest';
import { sanitizeLinkStyle } from '../src/sanitize';

describe('sanitizeLinkStyle', () => {
  it('허용 속성만 남긴다', () => {
    const out = sanitizeLinkStyle('color: red; position: fixed; padding: 4px') ?? '';
    expect(out).toContain('color: red');
    expect(out).toContain('padding: 4px');
    expect(out).not.toContain('position');
  });
  it('url()·expression() 값은 버린다', () => {
    expect(sanitizeLinkStyle('background: url(https://x.example.com/a.png)') ?? '').not.toContain('url(');
    expect(sanitizeLinkStyle('color: expression(alert(1))') ?? '').not.toContain('expression');
  });
});

describe('sanitizeLinkStyle — document 없는 서버', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('역슬래시 이스케이프로 숨긴 url( 은 지운다', () => {
    vi.stubGlobal('document', undefined);
    expect(sanitizeLinkStyle('background: u\\72l(https://evil.example.com/a.png); color: red')).toBe('color: red');
  });
});
