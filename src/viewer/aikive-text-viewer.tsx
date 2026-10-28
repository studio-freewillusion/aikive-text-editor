import { parseLegacyDoc, renderLegacyJson } from './render-legacy-json';
import { renderHtml } from './render-html';
import type { ImageSrcResolver } from './types';

export interface AikiveTextViewerProps {
  content?: string | null;
  onClickImage?: (src: string) => void;
  lazyMedia?: boolean;
  resolveImageSrc?: ImageSrcResolver;
  extraIframeHosts?: string[];
  embedHosts?: string[];
  className?: string;
}

const identity: ImageSrcResolver = (src) => src;

export function AikiveTextViewer({
  content,
  onClickImage,
  lazyMedia,
  resolveImageSrc = identity,
  extraIframeHosts,
  embedHosts,
  className,
}: AikiveTextViewerProps) {
  if (!content) return null;
  const options = { onClickImage, lazyMedia, resolveImageSrc };
  const rootClassName = ['tiptap', className].filter(Boolean).join(' ');
  const doc = parseLegacyDoc(content);

  // 본문 CSS 가 넘침(flex·큰 글자·밑줄 위치 등)으로 머리글 같은 바깥 화면을 칠하지 못하게 영역 밖을 자르고, 넓은 이미지·표는 가로 스크롤로 본다
  return (
    <div className={rootClassName} style={{ contain: 'paint', overflowX: 'auto', overflowY: 'hidden' }}>
      {doc ? renderLegacyJson(doc, options) : renderHtml(content, options, extraIframeHosts, embedHosts)}
    </div>
  );
}
