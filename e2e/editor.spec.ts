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
