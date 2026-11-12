import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEME_TEXT_COLORS } from '../src/editor';

describe('THEME_TEXT_COLORS', () => {
  it('THEME_TEXT_COLORS 는 8색이고 값은 모두 var(--aikive-color-이름, 다크 값) 이며 theme.css 에 같은 변수가 있다', () => {
    const theme = readFileSync('src/styles/theme.css', 'utf8');
    expect(THEME_TEXT_COLORS.map((c) => c.label)).toEqual(['강조', '회색', '빨강', '주황', '노랑', '초록', '파랑', '보라']);
    const parsed = THEME_TEXT_COLORS.map((c) => /^var\((--aikive-color-[a-z]+), (#[0-9a-f]{6})\)$/.exec(c.value));
    expect(parsed.every(Boolean)).toBe(true);
    expect(parsed.filter((m) => m && !theme.includes(`${m[1]}: ${m[2]};`)).map((m) => m?.[1])).toEqual([]);
  });
});
