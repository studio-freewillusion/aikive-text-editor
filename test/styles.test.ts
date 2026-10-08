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
  }, 180_000);
});
