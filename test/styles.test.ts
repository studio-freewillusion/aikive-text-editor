import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('styles.css', () => {
  it('하나로 합쳐지고 색은 변수로 바꿀 수 있으며 본문 규칙은 기존 화면 그대로다', () => {
    execSync('npm run build', { stdio: 'ignore' });
    const css = readFileSync('dist/styles.css', 'utf8');
    expect(css).not.toContain('@import');
    // 유튜브 크기 규칙은 기존 화면과 같게 .youtube 에만(옛 JSON 렌더러 출력) — 속성 선택자로 넓히면 HTML 유튜브 크기가 바뀐다
    expect(css).toContain('.tiptap .youtube');
    expect(css).not.toContain('div[data-youtube-video] iframe');
    expect(css).toContain('var(--aikive-text-fg');
    expect(css).toContain('var(--aikive-text-link');
    expect(css).toContain('.aikive-toolbar');
    // 표·코드 블록 가로 막대는 평소 숨기고 올렸을 때만 보인다(기존 화면과 같게)
    expect(css).toMatch(/\.tiptap pre,\s*\.tiptap \.tableWrapper\s*\{[^}]*scrollbar-color: transparent transparent/);
    expect(css).toMatch(/\.tiptap pre:hover[^{]*\{[^}]*scrollbar-color: var\(--aikive-text-scrollbar\) transparent/);
    expect(css).toContain('--aikive-text-scrollbar: rgba(255, 255, 255, 0.42)');
    // 좁은 칸의 툴바는 줄바꿈하지 않는다 — 들어가지 않는 항목은 「더 보기」 로 옮긴다(터치 기기는 밀어서 넘김)
    expect(css).not.toMatch(/\.aikive-toolbar(:not\([^)]*\))?\s*\{[^}]*flex-wrap: wrap/);
    expect(css).toMatch(/\.aikive-toolbar__more\s*\{[^}]*position: absolute/);
    // 터치 기기 고정 툴바는 밀어서 넘기므로 가로 막대를 숨긴다
    expect(css).toMatch(/\.aikive-toolbar\.is-scrollable\s*\{[^}]*scrollbar-width: none/);
    expect(css).toMatch(/\.aikive-toolbar\.is-scrollable::-webkit-scrollbar\s*\{[^}]*display: none/);
    // 입력 창은 본문 영역 overflow 에 잘리지 않게 fixed, 오류색은 변수로 바꿀 수 있다
    expect(css).toMatch(/\.aikive-popover\s*\{[^}]*position: fixed/);
    expect(css).toContain('--aikive-text-error: #f96960');
    // 인용은 어두운 기본 테마에서 읽히는 색이고 변수로 바꿀 수 있다
    expect(css).toMatch(/\.tiptap blockquote\s*\{[^}]*background: var\(--aikive-quote-bg\)/);
    expect(css).toContain('--aikive-quote-bg: #28282b');
    // 팔레트는 밀어서 넘기는 툴바 밖, 감싸는 상자 기준으로 띄운다
    expect(css).toMatch(/\.aikive-toolbar-wrap\s*\{[^}]*position: relative/);
    // 본문 글꼴은 Pretendard 가 기본이고 변수로 바꿀 수 있다(글꼴 파일은 쓰는 쪽이 불러온다)
    expect(css).toMatch(/\.tiptap\s*\{[^}]*font-family: var\(--aikive-text-font/);
    expect(css).toMatch(/--aikive-text-font:\s*Pretendard,/);
  }, 180_000);
});
