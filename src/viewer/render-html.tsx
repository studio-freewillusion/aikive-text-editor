import parse, { attributesToProps, domToReact, type DOMNode, type Element, type HTMLReactParserOptions } from 'html-react-parser';
import type React from 'react';
import { sanitizeRichHtml } from '../sanitize';
import type { RenderOptions } from './types';

export function renderHtml(
  html: string,
  { onClickImage, lazyMedia, resolveImageSrc }: RenderOptions,
  extraIframeHosts: string[] = [],
  embedHosts: string[] = [],
): React.ReactNode {
  const options: HTMLReactParserOptions = {
    replace: (node: DOMNode) => {
      if (node.type !== 'tag') return undefined;
      const el = node as Element;
      // 뷰어 루트가 영역 밖을 잘라 넓은 표는 옛 JSON 본문처럼 가로 스크롤 상자 안에 둔다
      if (el.name === 'table') {
        const parent = el.parent as Element | null;
        if (parent?.attribs?.class?.split(/\s+/).includes('tableWrapper')) return undefined;
        return (
          <div className="tableWrapper">
            <table {...attributesToProps(el.attribs)}>{domToReact(el.children as DOMNode[], options)}</table>
          </div>
        );
      }
      if (el.name !== 'img' || !el.attribs.src) return undefined;

      const { src } = el.attribs;
      // 링크가 걸린 이미지는 확대보다 링크 이동이 먼저다
      let insideLink = false;
      for (let p = el.parent as Element | null; p && !insideLink; p = p.parent as Element | null) insideLink = p.name === 'a';
      return (
        <img
          {...attributesToProps(el.attribs)}
          src={resolveImageSrc(src)}
          alt={el.attribs.alt ?? ''}
          onClick={!insideLink && onClickImage ? () => onClickImage(src) : undefined}
        />
      );
    },
  };
  return parse(sanitizeRichHtml(html, { lazyMedia, extraIframeHosts, embedHosts }), options);
}
