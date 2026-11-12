import type { ColorOption } from './types';

// 쓰는 쪽이 변수를 모드마다 덮어 같은 글을 라이트·다크에서 다른 색으로 그린다 — 대체값은 다크 값(theme.css 와 같게)
export const THEME_TEXT_COLORS: ColorOption[] = [
  { label: '강조', value: 'var(--aikive-color-strong, #ffffff)' },
  { label: '회색', value: 'var(--aikive-color-gray, #a6a6a6)' },
  { label: '빨강', value: 'var(--aikive-color-red, #f96960)' },
  { label: '주황', value: 'var(--aikive-color-orange, #ff6820)' },
  { label: '노랑', value: 'var(--aikive-color-yellow, #ffd43b)' },
  { label: '초록', value: 'var(--aikive-color-green, #51cf66)' },
  { label: '파랑', value: 'var(--aikive-color-blue, #46add4)' },
  { label: '보라', value: 'var(--aikive-color-purple, #b197fc)' },
];
