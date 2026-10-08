import parse, { attributesToProps, type DOMNode, type Element } from 'html-react-parser';
import type React from 'react';
import { sanitizeRichHtml } from '../sanitize';
import type { RenderOptions } from './types';

export function renderHtml(
  html: string,
  { onClickImage, lazyMedia, resolveImageSrc }: RenderOptions,
  extraIframeHosts: string[] = [],
): React.ReactNode {
  return parse(sanitizeRichHtml(html, { lazyMedia, extraIframeHosts }), {
    replace: (node: DOMNode) => {
      if (node.type !== 'tag') return undefined;
      const el = node as Element;
      if (el.name !== 'img' || !el.attribs.src) return undefined;

      const { src } = el.attribs;
      // 링크가 걸린 이미지는 확대보다 링크 이동이 먼저다
      const insideLink = (el.parent as Element | null)?.name === 'a';
      return (
        <img
          {...attributesToProps(el.attribs)}
          src={resolveImageSrc(src)}
          alt={el.attribs.alt ?? ''}
          onClick={!insideLink && onClickImage ? () => onClickImage(src) : undefined}
        />
      );
    },
  });
}
