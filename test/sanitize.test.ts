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
