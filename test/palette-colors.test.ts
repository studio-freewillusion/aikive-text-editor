import { describe, expect, it, vi } from 'vitest';
import { stripOffPaletteColors } from '../src/editor/palette-colors';

const parse = (html: string) => {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
};

const PALETTE = ['var(--aikive-color-red, #f96960)', 'var(--aikive-color-blue, #46add4)'];

describe('stripOffPaletteColors', () => {
  it('팔레트에 있는 글자색은 남긴다(공백·대소문자가 달라도 같은 값으로 본다)', () => {
    const html = '<p><span style="color: VAR(--aikive-color-red,#F96960)">빨강</span></p>';
    expect(stripOffPaletteColors(html, PALETTE)).toBe(html);
  });

  it('팔레트에 없는 글자색(hex·rgb·다른 변수)은 color 선언만 지우고 글자 크기 등 다른 선언은 남긴다', () => {
    const out = parse(
      stripOffPaletteColors(
        '<p><span style="color: #ff00ff; font-size: 24px">a</span>' +
          '<a href="https://example.com" style="color: rgb(1, 2, 3); background-color: #000">b</a>' +
          '<span style="color: var(--other, #fff)">c</span></p>',
        PALETTE,
      ),
    );
    const [a, b, c] = Array.from(out.querySelectorAll<HTMLElement>('span, a'));
    expect([a.style.color, a.style.fontSize]).toEqual(['', '24px']);
    expect([b.style.color, b.style.backgroundColor, b.getAttribute('href')]).toEqual(['', 'rgb(0, 0, 0)', 'https://example.com']);
    expect(c.hasAttribute('style')).toBe(false);
  });

  it('CSS 주석·대문자로 속성 이름을 감싸도 팔레트 밖 글자색을 지운다', () => {
    const out = parse(
      stripOffPaletteColors('<p><span style="color/**/: #ff00ff; font-size: 24px">a</span><span style="COLOR: #ff00ff">b</span></p>', PALETTE),
    );
    expect(Array.from(out.querySelectorAll<HTMLElement>('span')).map((el) => el.style.color)).toEqual(['', '']);
  });

  it('style 이 없거나 color 선언이 없는 요소는 그대로 둔다', () => {
    const html = '<p style="text-align: center">x</p><p><span style="font-size:24px;">y</span><span>z</span></p>';
    expect(stripOffPaletteColors(html, PALETTE)).toBe(html);
  });

  it('서버처럼 document 가 없으면 오류 없이 그대로 돌려준다', () => {
    const html = '<p><span style="color: #ff00ff">a</span></p>';
    vi.stubGlobal('document', undefined);
    try {
      expect(stripOffPaletteColors(html, PALETTE)).toBe(html);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('옛 JSON 문서는 글자 안에 style 마크업이 있어도 건드리지 않는다', () => {
    const json = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: "<span style='color: #ff00ff'>&quot;</span>" }] }],
    });
    expect(stripOffPaletteColors(json, PALETTE)).toBe(json);
  });
});
