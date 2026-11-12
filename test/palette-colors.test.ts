import { describe, expect, it } from 'vitest';
import { stripOffPaletteColors } from '../src/editor/palette-colors';

const PALETTE = ['var(--aikive-color-red, #f96960)', 'var(--aikive-color-blue, #46add4)'];

describe('stripOffPaletteColors', () => {
  it('팔레트에 있는 글자색은 남긴다(공백·대소문자가 달라도 같은 값으로 본다)', () => {
    const html = '<p><span style="color: VAR(--aikive-color-red,#F96960)">빨강</span></p>';
    expect(stripOffPaletteColors(html, PALETTE)).toBe(html);
  });

  it('팔레트에 없는 글자색(hex·rgb·다른 변수)은 color 선언만 지우고 글자 크기 등 다른 선언은 남긴다', () => {
    const html =
      '<p><span style="color: #ff00ff; font-size: 24px">a</span>' +
      '<a href="https://example.com" style="color: rgb(1, 2, 3); background-color: #000">b</a>' +
      '<span style="color: var(--other, #fff)">c</span></p>';
    expect(stripOffPaletteColors(html, PALETTE)).toBe(
      '<p><span style="font-size: 24px">a</span>' +
        '<a href="https://example.com" style="background-color: #000">b</a>' +
        '<span>c</span></p>',
    );
  });

  it('style 이 없거나 color 선언이 없는 요소는 그대로 둔다', () => {
    const html = '<p style="text-align: center">x</p><p><span style="font-size:24px;">y</span><span>z</span></p>';
    expect(stripOffPaletteColors(html, PALETTE)).toBe(html);
  });
});
