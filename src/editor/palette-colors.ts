const normalize = (value: string) => value.replace(/\s+/g, '').toLowerCase();

// 브라우저 CSSOM 은 var() 를 브라우저마다 다르게 정리할 수 있어 style 속성 글자를 직접 나눠 비교한다
export function stripOffPaletteColors(html: string, palette: readonly string[]): string {
  const allowed = new Set(palette.map(normalize));
  const template = document.createElement('template');
  template.innerHTML = html;
  let changed = false;
  template.content.querySelectorAll('[style]').forEach((element) => {
    const declarations = (element.getAttribute('style') ?? '')
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean);
    const kept = declarations.filter((declaration) => {
      const colon = declaration.indexOf(':');
      if (colon < 0 || declaration.slice(0, colon).trim().toLowerCase() !== 'color') return true;
      return allowed.has(normalize(declaration.slice(colon + 1)));
    });
    if (kept.length === declarations.length) return;
    changed = true;
    if (kept.length) element.setAttribute('style', kept.join('; '));
    else element.removeAttribute('style');
  });
  return changed ? template.innerHTML : html;
}
