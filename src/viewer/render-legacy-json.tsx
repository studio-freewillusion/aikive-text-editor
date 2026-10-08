import React, { Suspense, lazy } from 'react';
import { safeImageHref } from '../sanitize';
import type { RenderOptions, TiptapMark, TiptapNode } from './types';

// 이모지 데이터(약 570KB)는 이모지가 든 옛 글에서만 받는다 — 뷰어 기본 번들에 넣지 않는다
const EmojiText = lazy(() => import('./emoji-text'));




const getYoutubeEmbedSrc = (src?: string, start?: number): string | null => {
    if (!src) return null;

    try {
        const url = new URL(src);
        const pathname = url.pathname;

        let videoId = '';

        if (url.hostname === 'youtu.be') {
            videoId = pathname.replace(/^\/+/, '');
        } else if (pathname === '/watch') {
            videoId = url.searchParams.get('v') ?? '';
        } else if (pathname.startsWith('/embed/')) {
            videoId = pathname.replace('/embed/', '').split('/')[0] ?? '';
        } else if (pathname.startsWith('/shorts/')) {
            videoId = pathname.replace('/shorts/', '').split('/')[0] ?? '';
        }

        if (!videoId) return null;

        const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);

        url.searchParams.forEach((value, key) => {
            if (key === 'v') return;
            embedUrl.searchParams.set(key, value);
        });

        if (typeof start === 'number' && start > 0) {
            embedUrl.searchParams.set('start', String(start));
        }

        return embedUrl.toString();
    } catch {
        return null;
    }
};

// 텍스트 노드의 mark(bold/italic/link 등)를 중첩 태그로 적용
const applyMarks = (
    text: React.ReactNode,
    marks?: TiptapMark[],
    keyPrefix = 'm',
): React.ReactNode => {
    if (!marks || marks.length === 0) return text;

    return marks.reduce<React.ReactNode>((acc, mark, i) => {
        const key = `${keyPrefix}-${i}`;
        switch (mark.type) {
            case 'bold':
                return <strong key={key}>{acc}</strong>;
            case 'italic':
                return <em key={key}>{acc}</em>;
            case 'underline':
                return <u key={key}>{acc}</u>;
            case 'strike':
                return <s key={key}>{acc}</s>;
            case 'code':
                return <code key={key}>{acc}</code>;
            case 'link': {
                // CMS에서 새 탭/같은 탭을 선택할 수 있으므로 target 속성이 있으면 그대로 따르고,
                // 없으면 기존 동작(새 탭)을 유지한다.
                const target = (mark.attrs?.target as string | undefined) ?? '_blank';
                return (
                    <a
                        key={key}
                        href={mark.attrs?.href}
                        target={target}
                        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
                    >
                        {acc}
                    </a>
                );
            }
            case 'textStyle':
                return (
                    <span
                        key={key}
                        style={{
                            color: mark.attrs?.color,
                            fontSize: mark.attrs?.fontSize,
                            fontFamily: mark.attrs?.fontFamily,
                        }}
                    >
                        {acc}
                    </span>
                );
            default:
                return acc;
        }
    }, text);
};

/* eslint-disable @typescript-eslint/no-use-before-define */

function renderNode(node: TiptapNode, key: React.Key, options: RenderOptions): React.ReactNode {
    const { onClickImage, lazyMedia, resolveImageSrc } = options;

    switch (node.type) {
        case 'text':
            return (
                <React.Fragment key={key}>
                    {applyMarks(node.text, node.marks, String(key))}
                </React.Fragment>
            );
        case 'paragraph':
            return (
                <p
                    key={key}
                    style={{
                        textAlign: node.attrs?.textAlign || undefined,
                        lineHeight: node.attrs?.lineHeight || undefined,
                    }}
                >
                    {renderNodes(node.content, options)}
                </p>
            );
        case 'heading': {
            const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 1), 6);
            const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
            return (
                <Tag
                    key={key}
                    style={{
                        textAlign: node.attrs?.textAlign || undefined,
                        lineHeight: node.attrs?.lineHeight || undefined,
                    }}
                >
                    {renderNodes(node.content, options)}
                </Tag>
            );
        }
        case 'hardBreak':
            return <br key={key} />;
        case 'horizontalRule':
            return <hr key={key} />;
        case 'bulletList':
            return <ul key={key}>{renderNodes(node.content, options)}</ul>;
        case 'orderedList':
            return <ol key={key}>{renderNodes(node.content, options)}</ol>;
        case 'listItem':
            return <li key={key}>{renderNodes(node.content, options)}</li>;
        case 'blockquote':
            return <blockquote key={key}>{renderNodes(node.content, options)}</blockquote>;
        case 'codeBlock':
            return (
                <pre key={key}>
                    <code>{renderNodes(node.content, options)}</code>
                </pre>
            );
        case 'image':
        case 'customImage': {
            const src = node.attrs?.src;
            if (!src) return null;

            const href = safeImageHref(node.attrs?.href);
            const target = node.attrs?.target === '_blank' ? '_blank' : undefined;
            // 링크가 걸린 이미지는 확대 대신 링크 이동이 먼저다.
            const image = (
                // 클릭 확대에는 원본을 넘겨야 하므로 리사이즈본은 표시용으로만 쓴다.
                <img
                    src={resolveImageSrc(src)}
                    alt={node.attrs?.alt || ''}
                    width={node.attrs?.width || undefined}
                    loading={lazyMedia ? 'lazy' : undefined}
                    onClick={!href && onClickImage ? () => onClickImage(src) : undefined}
                />
            );

            if (!href) {
                return <React.Fragment key={key}>{image}</React.Fragment>;
            }

            return (
                <a
                    key={key}
                    href={href}
                    target={target}
                    rel={target ? 'noopener noreferrer' : undefined}
                >
                    {image}
                </a>
            );
        }
        case 'table':
            return (
                // 에디터는 ProseMirror 가 이 래퍼를 만들어 준다. 정적 렌더러에서는 직접 붙여
                // 좁은 화면에서 표가 가로로 스크롤되게 한다.
                <div key={key} className="tableWrapper">
                    <table>
                        <tbody>{renderNodes(node.content, options)}</tbody>
                    </table>
                </div>
            );
        case 'tableRow':
            return <tr key={key}>{renderNodes(node.content, options)}</tr>;
        case 'tableHeader':
        case 'tableCell': {
            const Tag = node.type === 'tableHeader' ? 'th' : 'td';
            const colwidth = node.attrs?.colwidth as number[] | null | undefined;
            const width = colwidth?.find((value) => Number(value) > 0);

            return (
                <Tag
                    key={key}
                    colSpan={node.attrs?.colspan || undefined}
                    rowSpan={node.attrs?.rowspan || undefined}
                    style={width ? { width: `${width}px` } : undefined}
                >
                    {renderNodes(node.content, options)}
                </Tag>
            );
        }
        case 'emoji':
            return <Suspense key={key} fallback={null}>
                    <EmojiText name={node.attrs?.name} />
                </Suspense>;
        case 'videoBlock': {
            const src = node.attrs?.src;
            if (!src) return null;

            return (
                <div
                    key={key}
                    data-type="videoBlock"
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: '#000',
                        width: node.attrs?.width || '100%',
                    }}
                >
                    <video
                        src={src}
                        poster={node.attrs?.poster || undefined}
                        height={node.attrs?.height || undefined}
                        controls={node.attrs?.controls ?? true}
                        loop={!!node.attrs?.loop}
                        muted={!!node.attrs?.muted}
                        playsInline={node.attrs?.playsinline ?? true}
                        preload={lazyMedia ? 'none' : undefined}
                        controlsList="nodownload"
                        disablePictureInPicture
                        style={{
                            display: 'block',
                            objectFit: 'contain',
                            backgroundColor: '#000',
                            maxWidth: '100%',
                        }}
                    />
                </div>
            );
        }
        case 'youtube': {
            const src = getYoutubeEmbedSrc(node.attrs?.src, Number(node.attrs?.start));
            if (!src) return null;

            return (
                <iframe
                    key={key}
                    className="youtube"
                    src={src}
                    title="YouTube video player"
                    width={node.attrs?.width || undefined}
                    height={node.attrs?.height || undefined}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    loading={lazyMedia ? 'lazy' : undefined}
                />
            );
        }
        default:
            // 알 수 없는 노드(youtube/video 등 클라이언트 전용 블록): 자식 텍스트만 보존
            if (node.content) {
                return (
                    <React.Fragment key={key}>{renderNodes(node.content, options)}</React.Fragment>
                );
            }
            if (node.text) return <React.Fragment key={key}>{node.text}</React.Fragment>;
            return null;
    }
}

function renderNodes(nodes: TiptapNode[] | undefined, options: RenderOptions): React.ReactNode {
    if (!nodes) return null;
    return nodes.map((node, i) => renderNode(node, i, options));
}
/* eslint-enable @typescript-eslint/no-use-before-define */

// HTML 본문도 JSON 본문과 같게 이미지를 표시 폭 리사이즈본으로 그리고, 링크 없는 이미지는 클릭하면 원본을 확대한다

export function parseLegacyDoc(content: string): TiptapNode | null {
    try {
        const parsed = JSON.parse(content);
        return parsed && typeof parsed === 'object' && parsed.type === 'doc' ? (parsed as TiptapNode) : null;
    } catch {
        return null;
    }
}

export function renderLegacyJson(doc: TiptapNode, options: RenderOptions): React.ReactNode {
    return renderNodes(doc.content, options);
}
