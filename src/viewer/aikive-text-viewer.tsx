import { parseLegacyDoc, renderLegacyJson } from './render-legacy-json';
import { renderHtml } from './render-html';
import type { ImageSrcResolver } from './types';

export interface AikiveTextViewerProps {
  content?: string | null;
  onClickImage?: (src: string) => void;
  lazyMedia?: boolean;
  resolveImageSrc?: ImageSrcResolver;
  extraIframeHosts?: string[];
  className?: string;
}

const identity: ImageSrcResolver = (src) => src;

export function AikiveTextViewer({
  content,
  onClickImage,
  lazyMedia,
  resolveImageSrc = identity,
  extraIframeHosts,
  className,
}: AikiveTextViewerProps) {
  if (!content) return null;
  const options = { onClickImage, lazyMedia, resolveImageSrc };
  const rootClassName = ['tiptap', className].filter(Boolean).join(' ');
  const doc = parseLegacyDoc(content);

  return (
    <div className={rootClassName}>
      {doc ? renderLegacyJson(doc, options) : renderHtml(content, options, extraIframeHosts)}
    </div>
  );
}
