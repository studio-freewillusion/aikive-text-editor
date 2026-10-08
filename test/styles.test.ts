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
  }, 180_000);
});
