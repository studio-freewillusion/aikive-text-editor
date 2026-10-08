import { describe, expect, it } from 'vitest';
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
