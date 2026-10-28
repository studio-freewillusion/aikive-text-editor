import { describe, expect, it } from 'vitest';
import DOMPurify from 'isomorphic-dompurify';
import { sanitizeRichHtml } from '../src/sanitize';

describe('sanitizeRichHtml', () => {
  it('script 와 이벤트 속성을 지운다', () => {
    const out = sanitizeRichHtml('<p onclick="x()">a<script>alert(1)</script></p>');
    expect(out).toBe('<p>a</p>');
  });

  it('허용 목록 밖 iframe 은 지우고 유튜브는 남긴다', () => {
    const out = sanitizeRichHtml(
      '<iframe src="https://evil.example.com/x"></iframe><iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe>',
    );
    expect(out).not.toContain('evil.example.com');
    expect(out).toContain('youtube-nocookie.com/embed/abc');
  });

  it('extraIframeHosts 로 넘긴 호스트는 이번 호출에서만 남긴다', () => {
    const html = '<iframe src="https://video.example.com/embed/1"></iframe>';
    expect(sanitizeRichHtml(html, { extraIframeHosts: ['video.example.com'] })).toContain('video.example.com');
    expect(sanitizeRichHtml(html)).not.toContain('video.example.com');
  });

  it('새 탭 링크에 rel=noopener noreferrer 를 붙인다', () => {
    expect(sanitizeRichHtml('<a href="https://a.example.com" target="_blank">x</a>')).toContain(
      'rel="noopener noreferrer"',
    );
  });

  it('p 안의 블록 요소는 브라우저처럼 p 밖으로 정리된다', () => {
    const out = sanitizeRichHtml('<p>앞<div>블록</div>뒤</p>');
    const doc = new DOMParser().parseFromString(out, 'text/html');
    expect(doc.querySelector('p div')).toBeNull();
  });

  it('lazyMedia 면 이미지·iframe 에 loading=lazy, 영상에 preload=none', () => {
    const out = sanitizeRichHtml(
      '<img src="https://cdn.example.com/a.png"><video src="https://cdn.example.com/a.mp4"></video>',
      { lazyMedia: true },
    );
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('preload="none"');
  });
  it('패키지 정화 규칙은 쓰는 쪽이 같은 라이브러리를 직접 부를 때는 걸리지 않는다', () => {
    sanitizeRichHtml('<p>a</p>');
    const out = DOMPurify.sanitize('<a href="https://example.com" target="_blank">x</a>', { ADD_ATTR: ['target'] });
    expect(out).not.toContain('rel=');
  });
});

describe('영상 블록 iframe', () => {
  const HOSTS = ['video.example.com'];
  const wrap = (src: string) => `<div data-aikive-video=""><iframe src="${src}"></iframe></div>`;

  it('허용 호스트의 embed 경로만 남기고 래퍼·referrerpolicy 를 둔다', () => {
    const out = sanitizeRichHtml(wrap('https://video.example.com/embed/watch/abc123'), { embedHosts: HOSTS });
    expect(out).toContain('data-aikive-video');
    expect(out).toContain('src="https://video.example.com/embed/watch/abc123"');
    expect(out).toContain('referrerpolicy="strict-origin-when-cross-origin"');
  });

  it.each([
    'https://video.example.com/embed/watch/abc123?preview=1',
    'https://video.example.com/watch?v=abc123',
    'https://video.example.com/embed/watch/abc123/../x',
    'https://video.example.com/settings',
    'https://other.example.com/embed/watch/abc123',
  ])('%s 는 iframe 을 지운다', (src) => {
    expect(sanitizeRichHtml(wrap(src), { embedHosts: HOSTS })).not.toContain('<iframe');
  });

  it('embedHosts 를 넘기지 않으면 지운다', () => {
    expect(sanitizeRichHtml(wrap('https://video.example.com/embed/watch/abc123'))).not.toContain('<iframe');
  });

  it('embedHosts 의 호스트는 extraIframeHosts 에 있어도 경로를 본다', () => {
    const out = sanitizeRichHtml(wrap('https://video.example.com/settings'), {
      embedHosts: HOSTS,
      extraIframeHosts: HOSTS,
    });
    expect(out).not.toContain('<iframe');
  });

  it('유튜브 iframe 에도 referrerpolicy 를 붙인다', () => {
    expect(sanitizeRichHtml('<iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe>')).toContain(
      'referrerpolicy="strict-origin-when-cross-origin"',
    );
  });
});

describe('본문 정화 — 입력 폼·화면 덮기 차단', () => {
  const styleOf = (html: string, selector: string) =>
    new DOMParser().parseFromString(sanitizeRichHtml(html), 'text/html').querySelector(selector)?.getAttribute('style') ??
    null;

  it('form·input·button·textarea·select·option·style 태그를 지운다', () => {
    const out = sanitizeRichHtml(
      '<p>a</p><style>body{display:none}</style><form action="https://evil.example.com"><input type="password"><textarea></textarea><select><option>1</option></select><button>로그인</button></form>',
    );
    expect(out).not.toMatch(/<(form|input|button|textarea|select|option|style)\b/i);
    expect(out).not.toContain('evil.example.com');
    expect(out).toContain('<p>a</p>');
  });

  it('style 속성에서 위치·겹침 속성을 지운다', () => {
    expect(
      styleOf(
        '<div style="position: fixed; inset: 0; top: 0; left: 0; z-index: 99999; transform: scale(40); animation: spin 1s; color: red">x</div>',
        'div',
      ),
    ).toBe('color: red');
  });

  it('url()·expression·역슬래시 이스케이프 값은 지운다', () => {
    expect(styleOf('<p style="background: url(https://evil.example.com/a.png); width: expression(1)">x</p>', 'p')).toBeNull();
    expect(styleOf('<div style="background: u\\72l(https://evil.example.com/a.png); color: red">x</div>', 'div')).toBe(
      'color: red',
    );
  });

  it('margin 은 값 그대로 둔다 — 영역 밖으로 나간 부분은 뷰어 루트가 자른다', () => {
    expect(styleOf('<p style="margin: -8px 0px 10vh; color: red">x</p>', 'p')).toBe('margin: -8px 0px 10vh; color: red');
  });

  it('dialog·svg·math 태그를 통째로 지운다', () => {
    const out = sanitizeRichHtml(
      '<dialog open><p>가짜</p></dialog><svg width="10" height="10" overflow="visible"><animateTransform attributeName="transform" type="scale" values="1;40"></animateTransform><rect x="-5000" width="10000" height="10000"></rect></svg><math><mi>x</mi></math><p>b</p>',
    );
    expect(out).not.toMatch(/<(dialog|svg|math|animateTransform|rect)\b/i);
    expect(out).toContain('<p>b</p>');
  });

  it('box-shadow·opacity 는 링크 스타일처럼 남긴다', () => {
    expect(styleOf('<a href="https://a.example.com" style="box-shadow: 0 2px 4px #000; opacity: 0.8">x</a>', 'a')).toBe(
      'box-shadow: 0 2px 4px #000; opacity: 0.8',
    );
  });

  it('width·min-width·max-width 길이 값은 본문 폭을 넘지 않게 min(값, 100%) 로 감싼다', () => {
    expect(styleOf('<section style="width: 1400px; min-width: 240px; max-width: 480px">x</section>', 'section')).toBe(
      'width: min(1400px, 100%); min-width: min(240px, 100%); max-width: min(480px, 100%)',
    );
    expect(styleOf('<div style="width: 100%; max-width: none; min-width: auto">x</div>', 'div')).toBe(
      'width: 100%; max-width: none; min-width: auto',
    );
  });

  it('허용 속성이 하나도 없으면 style 속성을 지운다', () => {
    expect(sanitizeRichHtml('<p style="position: absolute">x</p>')).toBe('<p>x</p>');
  });

  it('prod 본문이 쓰는 style 은 남긴다 — 폭 길이만 min(값, 100%) 로 감싼다', () => {
    const cases: Array<[string, string, string]> = [
      ['<img src="https://cdn.example.com/a.png" style="width: 155px; height: auto; cursor: pointer; display: block; margin: 0px auto">', 'img', 'width: min(155px, 100%); height: auto; cursor: pointer; display: block; margin: 0px auto'],
      ['<img src="https://cdn.example.com/a.png" style="max-width: 100%; box-sizing: border-box; image-rendering: -webkit-optimize-contrast; vertical-align: middle; border-style: none">', 'img', 'max-width: 100%; box-sizing: border-box; image-rendering: -webkit-optimize-contrast; vertical-align: middle; border-style: none'],
      ['<p><span style="font-size: 18px; color: #FF0000; line-height: 1.6; font-family: &quot;Noto Sans KR&quot;, sans-serif">a</span></p>', 'span', 'font-size: 18px; color: #FF0000; line-height: 1.6; font-family: "Noto Sans KR", sans-serif'],
      ['<p style="text-align: center">a</p>', 'p', 'text-align: center'],
      ['<img src="https://cdn.example.com/a.png" style="width: 100%; height: 200px; object-fit: cover; object-position: center; margin: 0px auto 0px 0px">', 'img', 'width: 100%; height: 200px; object-fit: cover; object-position: center; margin: 0px auto 0px 0px'],
      ['<img src="https://cdn.example.com/a.png" style="margin: unset">', 'img', 'margin: unset'],
      ['<iframe src="https://www.youtube.com/embed/abc" style="width: 100%; height: 315px; aspect-ratio: 16 / 9; display: block; border: 0"></iframe>', 'iframe', 'width: 100%; height: 315px; aspect-ratio: 16 / 9; display: block; border: 0'],
      ['<table style="min-width: 300px"><colgroup><col style="min-width: 25px; width: 120px"></colgroup><tbody><tr><td style="text-align: right">1</td></tr></tbody></table>', 'col', 'min-width: min(25px, 100%); width: min(120px, 100%)'],
      ['<a href="https://a.example.com" style="display: inline-block; padding: 12px 24px; background: rgb(255, 107, 53); color: #fff; border-radius: 8px; font-weight: 700; text-decoration: none; text-underline-offset: 3px">신청</a>', 'a', 'display: inline-block; padding: 12px 24px; background: rgb(255, 107, 53); color: #fff; border-radius: 8px; font-weight: 700; text-decoration: none; text-underline-offset: 3px'],
    ];
    for (const [html, selector, style] of cases) {
      expect(styleOf(html, selector), html).toBe(style);
    }
  });
});
