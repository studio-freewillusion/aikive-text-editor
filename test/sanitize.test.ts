import { describe, expect, it } from 'vitest';
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
});
