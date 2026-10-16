import { expect, test, type Page } from '@playwright/test';

const html = (page: Page) => page.getByTestId('html');
const open = (page: Page, content: string) => page.goto('/?content=' + encodeURIComponent(content));

test('한글 입력과 되돌리기', async ({ page }) => {
  await open(page, '<p></p>');
  await page.locator('.ProseMirror').click();
  await page.keyboard.type('안녕하세요');
  await expect(html(page)).toHaveText('<p>안녕하세요</p>');
  await page.waitForTimeout(600);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(html(page)).toHaveText('');
});

test('이미지와 영상을 함께 끌어다 놓으면 영상만 빠진다', async ({ page }) => {
  await open(page, '<p>a</p>');
  await page.locator('.ProseMirror').evaluate((el) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(10)], 'clip.mp4', { type: 'video/mp4' }));
    dt.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'a.png', { type: 'image/png' }));
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5 }));
  });
  await expect(page.getByTestId('notices')).toContainText('영상 파일은 첨부할 수 없습니다.');
  await expect(html(page)).toContainText('<img');
});

test('목록에 없는 형식을 끌어다 놓으면 안내하고 브라우저가 파일을 열지 않는다', async ({ page }) => {
  await open(page, '<p>a</p>');
  const prevented = await page.locator('.ProseMirror').evaluate((el) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(10)], 'doc.pdf', { type: 'application/pdf' }));
    const r = el.getBoundingClientRect();
    const ev = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5 });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(prevented).toBe(true);
  await expect(page.getByTestId('notices')).toContainText('지원하지 않는 파일 형식입니다.');
});

test('붙여넣은 HTML 속 영상은 들어오지 않는다', async ({ page }) => {
  await open(page, '<p></p>');
  await page.locator('.ProseMirror').click();
  await page.locator('.ProseMirror').evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData('text/html', '<p>붙임</p><video src="https://cdn.example.com/a.mp4"></video>');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(html(page)).toContainText('붙임');
  await expect(html(page)).not.toContainText('<video');
});

test('표 열 너비를 끌어서 바꾸면 colwidth 가 저장된다', async ({ page }) => {
  await open(page, '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>');
  const cell = page.locator('.ProseMirror td').first();
  const box = (await cell.boundingBox())!;
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 60, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(html(page)).toContainText('colwidth');
});

test('이미지를 클릭하면 크기 조절 손잡이가 나오고 끌면 폭이 바뀐다', async ({ page }) => {
  await open(page, '<p>a</p><img src="http://localhost:5199/sample.png">');
  const img = page.locator('.ProseMirror img').first();
  await img.click();
  const handle = page.locator('[data-image-control="resize"]').last();
  await expect(handle).toBeVisible();
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x - 100, hb.y + hb.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(html(page)).toContainText(/width: \d+px/);
});

test('링크가 걸린 이미지는 뷰어에서 링크로 그린다', async ({ page }) => {
  await open(page, '<a href="https://example.com" target="_blank"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="링크 이미지"></a>');
  const link = page.getByTestId('viewer').locator('a', { has: page.locator('img') });
  await expect(link).toHaveAttribute('href', 'https://example.com');
  await expect(link).toHaveAttribute('rel', /noopener/);
});

test('최신 이모지는 지원하는 브라우저에서 글자로 저장된다', async ({ page }) => {
  await open(page, '<p>a <span data-type="emoji" data-name="jellyfish">🪼</span> <span data-type="emoji" data-name="bubbles">🫧</span></p>');
  await page.locator('.ProseMirror').click();
  await page.keyboard.press('End');
  await page.keyboard.type('b');
  await expect(html(page)).toContainText('🪼');
  await expect(html(page)).toContainText('🫧');
  await expect(html(page)).not.toContainText('<img');
});

test('Ctrl/⌘+K 로 링크 창을 열어 Enter 로 링크를 건다', async ({ page }) => {
  await open(page, '<p>안녕</p>');
  await page.locator('.ProseMirror').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.getByRole('dialog', { name: '링크' }).getByLabel('주소');
  await expect(input).toBeFocused();
  await input.fill('example.com');
  await input.press('Enter');
  await expect(html(page)).toContainText('href="https://example.com"');
  await expect(page.getByRole('dialog', { name: '링크' })).toHaveCount(0);
});

test('화면 아래쪽 글자에서 열면 링크 창이 위로 열린다', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 400 });
  await open(page, '<p>1</p>'.repeat(40) + '<p>끝</p>');
  const last = page.locator('.ProseMirror p').last();
  await last.scrollIntoViewIfNeeded();
  await last.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().bottom - window.innerHeight + 10));
  await last.click();
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog', { name: '링크' });
  const box = (await dialog.boundingBox())!;
  const lastBox = (await last.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(lastBox.y);
});

test('터치로 이미지 손잡이를 끌면 폭이 바뀐다', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, baseURL: 'http://localhost:5199' });
  const page = await context.newPage();
  await open(page, '<p>a</p><img src="http://localhost:5199/sample.png">');
  await page.locator('.ProseMirror img').first().tap();
  const handle = page.locator('[data-image-control="resize"]').last();
  await expect(handle).toBeVisible();
  const hb = (await handle.boundingBox())!;
  const x = hb.x + hb.width / 2;
  const y = hb.y + hb.height / 2;
  await handle.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, clientX: x, clientY: y });
  for (const dx of [20, 40, 60, 80, 100]) {
    await page.evaluate(
      ([cx, cy]) =>
        document.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', clientX: cx, clientY: cy, bubbles: true })),
      [x - dx, y],
    );
  }
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true })));
  await expect(html(page)).toContainText(/width: \d+px/);
  await context.close();
});

for (const toolbar of ['fixed', 'bubble']) {
  test(`이미지 조작 바의 대체 텍스트로 alt 를 넣는다(${toolbar})`, async ({ page }) => {
    await page.goto(`/?toolbar=${toolbar}&content=` + encodeURIComponent('<p>a</p><img src="http://localhost:5199/sample.png">'));
    await page.locator('.ProseMirror img').first().click();
    await page.locator('[data-image-control][aria-label="대체 텍스트"]').click();
    const input = page.getByRole('dialog', { name: '대체 텍스트' }).getByRole('textbox');
    await expect(input).toBeFocused();
    await input.fill('장면');
    await input.press('Enter');
    await expect(html(page)).toContainText('alt="장면"');
  });
}

test('크기 조절 손잡이를 끌지 않고 누르기만 하면 폭이 그대로다', async ({ page }) => {
  await open(page, '<p>a</p><img src="http://localhost:5199/sample.png">');
  await page.locator('.ProseMirror img').first().click();
  const handle = page.locator('[data-image-control="resize"]').last();
  await expect(handle).toBeVisible();
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await expect(html(page)).toContainText('width: 100%');
  await expect(html(page)).not.toContainText('width: 100px');
});

test('말풍선 툴바는 에디터 좌우 밖으로 나가지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 800 });
  await page.goto('/?toolbar=bubble&content=' + encodeURIComponent('<p>왼쪽 끝 글자에서 고른다 그리고 오른쪽 끝까지 이어지는 꽤 긴 문장입니다 끝</p>'));
  await page.addStyleTag({ content: '.aikive-text-editor { max-width: 700px; margin-left: 300px; }' });
  const editorBox = (await page.locator('.aikive-text-editor').boundingBox())!;
  for (const word of ['왼쪽', '끝']) {
    const text = page.locator('.ProseMirror p').first();
    await text.evaluate((el, w) => {
      const node = el.firstChild!;
      const i = w === '왼쪽' ? 0 : node.textContent!.length - 1;
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + w.length);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
    }, word);
    await page.locator('.ProseMirror').focus();
    const bar = page.getByRole('toolbar', { name: '서식' });
    await expect(bar).toBeVisible();
    await page.waitForTimeout(200);
    const box = (await bar.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(editorBox.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(editorBox.x + editorBox.width + 1);
  }
});

test('전체 선택한 말풍선 툴바는 글자 위치를 따른다(왼쪽 글이면 왼쪽, 오른쪽 글이면 오른쪽)', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 800 });
  for (const [align, side] of [['left', 'left'], ['right', 'right']] as const) {
    await page.goto('/?toolbar=bubble&content=' + encodeURIComponent(`<p style="text-align: ${align}">짧은 줄</p><p style="text-align: ${align}">둘째 줄</p>`));
    const editorBox = (await page.locator('.aikive-text-editor').boundingBox())!;
    await page.locator('.ProseMirror p').last().click();
    await page.keyboard.press('ControlOrMeta+a');
    const bar = page.getByRole('toolbar', { name: '서식' });
    await expect(bar).toBeVisible();
    await page.waitForTimeout(200);
    const box = (await bar.boundingBox())!;
    if (side === 'left') expect(box.x).toBeLessThanOrEqual(editorBox.x + 1);
    else expect(box.x + box.width).toBeGreaterThanOrEqual(editorBox.x + editorBox.width - 1);
  }
});

test('끝이 인용·목록이거나 빈 줄까지 고른 선택도 말풍선 툴바가 글자 쪽에 붙는다', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 800 });
  for (const content of [
    '<blockquote><p style="text-align: right">인용 오른쪽</p></blockquote>',
    '<ul><li><p style="text-align: right">항목1</p></li><li><p style="text-align: right">항목2</p></li></ul>',
  ]) {
    await page.goto('/?toolbar=bubble&content=' + encodeURIComponent(content));
    const editorBox = (await page.locator('.aikive-text-editor').boundingBox())!;
    await page.locator('.ProseMirror p').first().click();
    await page.keyboard.press('ControlOrMeta+a');
    const bar = page.getByRole('toolbar', { name: '서식' });
    await expect(bar).toBeVisible();
    await page.waitForTimeout(200);
    const box = (await bar.boundingBox())!;
    expect(box.x + box.width).toBeGreaterThanOrEqual(editorBox.x + editorBox.width - 1);
  }
  await page.goto('/?toolbar=bubble&content=' + encodeURIComponent('<p style="text-align: right">오른쪽 글</p><p></p>'));
  const editorBox = (await page.locator('.aikive-text-editor').boundingBox())!;
  await page.locator('.ProseMirror').evaluate((el) => {
    const range = document.createRange();
    range.setStart(el.querySelector('p')!.firstChild!, 0);
    range.setEnd(el.querySelectorAll('p')[1], 0);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
  });
  await page.locator('.ProseMirror').focus();
  const bar = page.getByRole('toolbar', { name: '서식' });
  await expect(bar).toBeVisible();
  await page.waitForTimeout(200);
  const box = (await bar.boundingBox())!;
  expect(box.x + box.width).toBeGreaterThanOrEqual(editorBox.x + editorBox.width - 1);
});

for (const startEditable of [true, false]) {
test(`말풍선 툴바 폭이 바뀌면 위치를 다시 잡아 오른쪽 글에 붙어 있다(${startEditable ? '처음부터 편집' : '편집을 나중에 켬'})`, async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 800 });
  const cell = (t: string) => `<td><p style="text-align: right">${t}</p></td>`;
  await page.goto(`/?toolbar=bubble${startEditable ? '' : '&editable=false'}&content=` + encodeURIComponent(`<p style="text-align: right">오른쪽 글</p><table><tbody><tr>${cell('셀1')}${cell('셀2')}</tr></tbody></table>`));
  if (!startEditable) await page.getByRole('button', { name: '편집 전환' }).click();
  const editorBox = (await page.locator('.aikive-text-editor').boundingBox())!;
  const bar = page.getByRole('toolbar', { name: '서식' });
  await page.locator('.ProseMirror td p').last().click();
  await expect(bar).toBeVisible();
  const wide = (await bar.boundingBox())!.width;
  await page.keyboard.press('ControlOrMeta+a');
  await expect.poll(async () => (await bar.boundingBox())!.width).toBeLessThan(wide);
  await page.waitForTimeout(300);
  const box = (await bar.boundingBox())!;
  expect(box.x + box.width).toBeGreaterThanOrEqual(editorBox.x + editorBox.width - 1);
});
}

for (const [mode, width] of [['fixed', 380], ['bubble', 380], ['fixed', 480], ['bubble', 480]] as const) {
  test(`좁은 에디터(${width}px)에서 ${mode === 'fixed' ? '고정' : '말풍선'} 툴바는 한 줄로 두고 넘치는 항목을 더 보기에 넣는다`, async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 800 });
    await page.goto(`/?toolbar=${mode}&content=` + encodeURIComponent('<p>좁은 칸 글자</p>'));
    await page.addStyleTag({ content: `.aikive-text-editor { max-width: ${width}px; }` });
    const editorBox = (await page.locator('.aikive-text-editor').boundingBox())!;
    const bar = page.getByRole('toolbar', { name: '서식' });
    await page.locator('.ProseMirror p').click();
    await page.keyboard.press('End');
    await page.keyboard.type('x');
    await expect(html(page)).toHaveText('<p>좁은 칸 글자x</p>');
    await page.waitForTimeout(600);
    if (mode === 'bubble') await page.keyboard.press('ControlOrMeta+a');
    await expect(bar).toBeVisible();
    const more = bar.getByRole('button', { name: '더 보기' });
    await expect(more).toBeVisible();
    await page.waitForTimeout(300);
    const box = (await bar.boundingBox())!;
    expect(box.height).toBeLessThan(45);
    expect(box.x + box.width).toBeLessThanOrEqual(editorBox.x + editorBox.width + 1);
    // 오른쪽 끝 항목부터 옮겨져 되돌리기 줄은 더 보기 안에 있다
    await expect(bar.getByRole('button', { name: '다시 하기' })).toHaveCount(0);
    await more.click();
    const panel = page.locator('.aikive-toolbar__more');
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: '되돌리기' }).click();
    await expect(html(page)).toHaveText('<p>좁은 칸 글자</p>');
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });
}

test('넓은 에디터에서는 더 보기 없이 모든 항목이 한 줄에 있다', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 800 });
  await open(page, '<p>넓은 칸</p>');
  const bar = page.getByRole('toolbar', { name: '서식' });
  await expect(bar.getByRole('button', { name: '다시 하기' })).toBeVisible();
  await expect(bar.getByRole('button', { name: '더 보기' })).toHaveCount(0);
});

test('더 보기 상자의 Esc 는 상자만 닫고 바깥(다이얼로그 등)으로 넘기지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 800 });
  await open(page, '<p>좁은 칸 글자</p>');
  await page.addStyleTag({ content: '.aikive-text-editor { max-width: 380px; }' });
  await page.evaluate(() => {
    (window as unknown as { escSeen: number }).escSeen = 0;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') (window as unknown as { escSeen: number }).escSeen += 1;
    }, { capture: true });
  });
  const more = page.getByRole('button', { name: '더 보기' });
  await more.click();
  const panel = page.locator('.aikive-toolbar__more');
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { escSeen: number }).escSeen)).toBe(0);
  await expect(more).toBeFocused();
});

test('더 보기 상자는 칸이 넓어져 사라지면 닫히고, 다시 좁아져도 저절로 열리지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 800 });
  await open(page, '<p>좁은 칸 글자</p>');
  const setWidth = (w: number) => page.evaluate((w) => { document.querySelector<HTMLElement>('.aikive-text-editor')!.style.maxWidth = `${w}px`; }, w);
  await setWidth(380);
  const more = page.getByRole('button', { name: '더 보기' });
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await setWidth(1000);
  await expect(more).toHaveCount(0);
  await setWidth(380);
  await expect(more).toBeVisible();
  await expect(page.locator('.aikive-toolbar__more')).toBeHidden();
});

test('칸이 좁아져 포커스 항목이 더 보기로 옮겨지면 포커스는 더 보기 버튼으로 간다', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 800 });
  await open(page, '<p>좁은 칸 글자</p>');
  await page.getByRole('button', { name: 'HTML 모드' }).focus();
  await page.evaluate(() => { document.querySelector<HTMLElement>('.aikive-text-editor')!.style.maxWidth = '380px'; });
  await expect(page.getByRole('button', { name: '더 보기' })).toBeFocused();
});

test('더 보기 상자 안에서 링크 입력 창을 열면 상자는 닫힌다', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 800 });
  await open(page, '<p>좁은 칸 글자</p>');
  await page.addStyleTag({ content: '.aikive-text-editor { max-width: 380px; }' });
  await page.locator('.ProseMirror p').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.getByRole('button', { name: '더 보기' }).click();
  const panel = page.locator('.aikive-toolbar__more');
  await panel.getByRole('button', { name: '링크 연결' }).click();
  await expect(page.locator('.aikive-popover')).toBeVisible();
  await expect(panel).toBeHidden();
});

test('더 보기 상자가 열린 채 본문에서 Esc 를 눌러도 이어 치는 글자는 본문에 들어간다', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 800 });
  await open(page, '<p>좁은 칸 글자</p>');
  await page.addStyleTag({ content: '.aikive-text-editor { max-width: 380px; }' });
  await page.locator('.ProseMirror p').click();
  await page.keyboard.press('End');
  await page.getByRole('button', { name: '더 보기' }).click();
  await page.locator('.ProseMirror').focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Escape');
  await page.keyboard.type('ab');
  await expect(html(page)).toHaveText('<p>좁은 칸 글자ab</p>');
  await expect(page.locator('.aikive-toolbar__more')).toBeHidden();
});

test('더 보기 상자가 열린 채 링크 입력 창을 Esc 로 닫으면 입력 창만 닫히고 본문에 이어 쓸 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 800 });
  await open(page, '<p>좁은 칸 글자</p>');
  await page.addStyleTag({ content: '.aikive-text-editor { max-width: 380px; }' });
  await page.locator('.ProseMirror p').click();
  await page.keyboard.press('End');
  await page.getByRole('button', { name: '더 보기' }).click();
  await page.locator('.ProseMirror').focus();
  await page.keyboard.press('End');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('.aikive-popover')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.aikive-popover')).toBeHidden();
  await expect(page.locator('.ProseMirror')).toBeFocused();
  await page.keyboard.type('z');
  await expect(html(page)).toContainText('z');
});

test('더 보기 상자가 열린 채 단축키로 링크 입력 창을 열면 상자는 닫힌다', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 800 });
  await open(page, '<p>좁은 칸 글자</p>');
  await page.addStyleTag({ content: '.aikive-text-editor { max-width: 380px; }' });
  await page.locator('.ProseMirror p').click();
  await page.getByRole('button', { name: '더 보기' }).click();
  await page.locator('.ProseMirror').focus();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('.aikive-popover')).toBeVisible();
  await expect(page.locator('.aikive-toolbar__more')).toBeHidden();
});

test.describe('영상 주소 붙여넣기', () => {
  const AIKIVE = 'https://video.example.com/watch?v=abc123';
  const EMBED_SRC = 'https://video.example.com/embed/watch/abc123';
  const pasteText = (page: Page, text: string) =>
    page.locator('.ProseMirror').evaluate((el, t) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', t);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, text);
  const menu = (page: Page) => page.getByRole('menu', { name: '붙여넣기 방식' });

  test.beforeEach(async ({ page }) => {
    await page.route('https://video.example.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>player</p>' }));
    await open(page, '<p></p>');
    await page.locator('.ProseMirror').click();
  });

  test('「플레이어로 넣기」 를 고르면 영상 블록이 되고 에디터 안에서만 미리 보기 주소를 쓴다', async ({ page }) => {
    await pasteText(page, AIKIVE);
    await menu(page).getByRole('menuitem', { name: '플레이어로 넣기' }).click();
    await expect(menu(page)).toBeHidden();
    await expect(html(page)).toContainText(`<div data-aikive-video=""><iframe src="${EMBED_SRC}"`);
    await expect(page.locator('.ProseMirror [data-aikive-video] iframe')).toHaveAttribute('src', `${EMBED_SRC}?preview=1`);
    await expect(page.locator('[data-testid="viewer"] [data-aikive-video] iframe')).toHaveAttribute('src', EMBED_SRC);
  });

  test('끝에 줄바꿈이 붙은 주소도 창이 뜨고 줄이 늘지 않는다', async ({ page }) => {
    await pasteText(page, `${AIKIVE}\n`);
    await expect(menu(page)).toBeVisible();
    await expect(page.locator('.ProseMirror > p')).toHaveCount(1);
    await expect(html(page)).toContainText(`href="${AIKIVE}"`);
  });

  test('↑ 와 Enter 로 플레이어를 넣는다', async ({ page }) => {
    await pasteText(page, AIKIVE);
    await expect(menu(page)).toBeVisible();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(html(page)).toContainText('data-aikive-video');
  });

  test('선택 창의 Esc 는 창만 닫고 바깥(다이얼로그 등)으로 넘기지 않으며 이어 쓸 수 있다', async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as { escSeen: number }).escSeen = 0;
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') (window as unknown as { escSeen: number }).escSeen += 1;
      }, { capture: true });
    });
    await pasteText(page, AIKIVE);
    await expect(menu(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu(page)).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { escSeen: number }).escSeen)).toBe(0);
    await page.keyboard.type('다음');
    await expect(html(page)).toContainText(`href="${AIKIVE}"`);
    await expect(html(page)).toContainText('다음');
  });
});

test('줄간격을 지정한 문단은 문단 사이 간격도 같은 비율로 바뀐다(편집 화면과 보기 화면 같게)', async ({ page }) => {
  await open(
    page,
    '<p>기본</p><p>기본 다음</p><p><span style="line-height: 2">두 배</span></p><p><span style="line-height: 1">한 배</span></p><ul><li><p>a</p><p><span style="line-height: 2">b</span></p></li></ul>',
  );
  for (const area of ['.ProseMirror', '[data-testid="viewer"] .tiptap']) {
    const gaps = await page.locator(area).first().evaluate((root) =>
      [...root.querySelectorAll(':scope > p, li p')].map((p) => parseFloat(getComputedStyle(p).marginTop)),
    );
    const rem = 16;
    // 기본은 그대로, 줄간격 2·1 은 기본 1.65 대비 비율만큼, 목록 안 문단도 같은 비율
    expect(gaps[1], area).toBeCloseTo(0.4 * rem, 1);
    expect(gaps[2], area).toBeCloseTo((0.4 * rem * 2) / 1.65, 1);
    expect(gaps[3], area).toBeCloseTo((0.4 * rem * 1) / 1.65, 1);
    expect(gaps[5], area).toBeCloseTo((0.15 * rem * 2) / 1.65, 1);
  }
});
