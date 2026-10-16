import { describe, expect, it } from 'vitest';
import { aikiveEmbedSrc, isAikiveEmbedSrc, parseAikiveVideoUrl } from '../src/sanitize';

const HOSTS = ['video.example.com', 'www.video.example.com'];

describe('parseAikiveVideoUrl', () => {
  it.each([
    ['https://video.example.com/watch?v=abc123', 'abc123'],
    ['https://video.example.com/watch?v=abc_DEF-9&t=30', 'abc_DEF-9'],
    ['https://www.video.example.com/embed/watch/abc123', 'abc123'],
    ['  https://video.example.com/watch?v=abc123  ', 'abc123'],
  ])('%s 의 ID 는 %s', (input, id) => {
    expect(parseAikiveVideoUrl(input, HOSTS)?.id).toBe(id);
  });

  it('호스트는 대소문자를 가리지 않고 소문자로 돌려준다', () => {
    expect(parseAikiveVideoUrl('https://VIDEO.example.com/watch?v=abc123', ['Video.Example.com'])).toEqual({
      host: 'video.example.com',
      id: 'abc123',
    });
  });

  it.each([
    'https://video.example.com/watch?v=12345',
    'https://video.example.com/watch?v=',
    `https://video.example.com/watch?v=${'a'.repeat(65)}`,
    'https://video.example.com/watch?v=a%2Fb',
    'https://video.example.com/embed/watch/abc123?t=3',
    'https://video.example.com/embed/watch/abc123#x',
    'https://video.example.com/embed/watch/abc123/',
    'https://video.example.com/shorts/abc123',
    'http://video.example.com/watch?v=abc123',
    'https://video.example.com:8443/watch?v=abc123',
    'https://user@video.example.com/watch?v=abc123',
    'https://other.example.com/watch?v=abc123',
    'https://video.example.com.evil.test/watch?v=abc123',
    'not a url',
  ])('%s 는 받지 않는다', (input) => {
    expect(parseAikiveVideoUrl(input, HOSTS)).toBeNull();
  });

  it('호스트 목록이 비면 아무 주소도 받지 않는다', () => {
    expect(parseAikiveVideoUrl('https://video.example.com/watch?v=abc123', [])).toBeNull();
  });
});

describe('aikiveEmbedSrc·isAikiveEmbedSrc', () => {
  it('embed 주소를 만든다', () => {
    expect(aikiveEmbedSrc({ host: 'video.example.com', id: 'abc123' })).toBe('https://video.example.com/embed/watch/abc123');
  });

  it('정규화된 embed 주소만 통과한다', () => {
    expect(isAikiveEmbedSrc('https://video.example.com/embed/watch/abc123', HOSTS)).toBe(true);
    for (const src of [
      'https://video.example.com/watch?v=abc123',
      'https://VIDEO.example.com/embed/watch/abc123',
      'https://video.example.com/embed/watch/abc123#',
      'https://video.example.com/embed/watch/abc123?preview=1',
      'https://video.example.com/embed/watch/abc123/../x',
      'https://other.example.com/embed/watch/abc123',
    ]) {
      expect(isAikiveEmbedSrc(src, HOSTS), src).toBe(false);
    }
  });
});
