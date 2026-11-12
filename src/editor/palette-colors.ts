// CSS 변수 이름만 대소문자를 가린다 — 함수 이름·hex 는 가리지 않는다(hex·rgb 차이는 팔레트도 CSSOM 을 거쳐 맞춰진다)
const normalize = (value: string) =>
  value.replace(/\s+/g, '').replace(/(--[\w-]+)|[A-Z]+/g, (match, name?: string) => name ?? match.toLowerCase());

// 속성 이름의 주석·이스케이프·대소문자는 tiptap 처럼 CSSOM 으로 읽어 맞춘다 — var() 정리 모양은 브라우저마다 달라 팔레트 값도 같은 CSSOM 을 거친다
export function stripOffPaletteColors(html: string, palette: readonly string[]): string {
  // 서버 렌더에서도 에디터 옵션을 만들며 불린다 — 거르기는 브라우저에서 다시 그릴 때 한다
  if (typeof document === 'undefined') return html;
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
    // jsdom 처럼 MathML 요소에 style 객체가 없는 환경이 있다
    const color = element.style?.color;
    if (!color || allowed.has(normalize(color))) return;
    changed = true;
    element.style.removeProperty('color');
    if (!element.style.length) element.removeAttribute('style');
  });
  return changed ? template.innerHTML : html;
}
