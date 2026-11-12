// 툴바는 #rrggbb 로 넣지만 저장한 글을 다시 열면 브라우저가 rgb(…) 로 바꿔 둔다 — 같은 색으로 본다
const normalize = (value: string) => {
  const compact = value.replace(/\s+/g, '').toLowerCase();
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(compact);
  return hex ? `rgb(${hex.slice(1).map((h) => parseInt(h, 16)).join(',')})` : compact;
};

// 옛 tiptap JSON 문서는 parseContent 가 HTML 로 읽지 않는다 — HTML 로 다시 쓰면 문서가 깨진다
const isJson = (text: string) => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

// 속성 이름의 주석·이스케이프·대소문자는 tiptap 처럼 CSSOM 으로 읽어 맞춘다 — var() 정리 모양은 브라우저마다 달라 팔레트 값도 같은 CSSOM 을 거친다
export function stripOffPaletteColors(html: string, palette: readonly string[]): string {
  // 서버 렌더에서도 에디터 옵션을 만들며 불린다 — 거르기는 브라우저에서 다시 그릴 때 한다
  if (typeof document === 'undefined') return html;
  if (isJson(html)) return html;
  const probe = document.createElement('span');
  const allowed = new Set(
    palette.flatMap((value) => {
      probe.style.color = '';
      probe.style.color = value;
      return [normalize(value), normalize(probe.style.color)];
    }),
  );
  const template = document.createElement('template');
  template.innerHTML = html;
  let changed = false;
  template.content.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
    const color = element.style.color;
    if (!color || allowed.has(normalize(color))) return;
    changed = true;
    element.style.removeProperty('color');
    if (!element.style.length) element.removeAttribute('style');
  });
  return changed ? template.innerHTML : html;
}
