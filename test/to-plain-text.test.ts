import { describe, expect, it } from 'vitest';
import { toPlainText } from '../src/viewer';

describe('toPlainText', () => {
  it('HTML 은 태그를 떼고 문단 사이를 띄운다', () => {
    expect(toPlainText('<p>첫 문단</p><p>둘째 <strong>문</strong>단</p>')).toBe('첫 문단 둘째 문단');
  });
  it('옛 JSON 은 글자 노드를 띄어 잇는다', () => {
    const doc = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'b' }] }] });
    expect(toPlainText(doc)).toBe('a b');
  });
  it('비어 있으면 빈 문자열', () => {
    expect(toPlainText(null)).toBe('');
  });
});
