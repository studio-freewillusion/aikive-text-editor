import { sanitizeLinkStyle } from '../sanitize';

const extractPixelWidth = (value: string | null | undefined) => {
    if (!value) {
        return null;
    }

    const match = value.match(/(\d+(?:\.\d+)?)/);

    if (!match) {
        return null;
    }

    const width = Number.parseFloat(match[1]);

    if (!Number.isFinite(width) || width <= 0) {
        return null;
    }

    return Math.round(width);
};

const extractPixelWidthFromStyleDeclaration = (styleText: string | null | undefined) => {
    if (!styleText) {
        return null;
    }

    const match = styleText.match(/(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)px\b/i);

    if (!match) {
        return null;
    }

    return extractPixelWidth(match[1]);
};

const extractExplicitColWidth = (col: HTMLTableColElement) => {
    return (
        extractPixelWidth(col.getAttribute('width')) ??
        extractPixelWidth(col.style.width) ??
        extractPixelWidthFromStyleDeclaration(col.getAttribute('style'))
    );
};

const BLOCK_TAGS = new Set([
    'ADDRESS',
    'ARTICLE',
    'ASIDE',
    'BLOCKQUOTE',
    'DIV',
    'DL',
    'FIELDSET',
    'FIGCAPTION',
    'FIGURE',
    'FOOTER',
    'FORM',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'HEADER',
    'HR',
    'MAIN',
    'NAV',
    'OL',
    'P',
    'PRE',
    'SECTION',
    'TABLE',
    'UL',
]);

const isPreservedContainer = (element: HTMLDivElement) => {
    return (
        element.hasAttribute('data-youtube-video') ||
        element.getAttribute('data-type') === 'videoBlock'
    );
};

const hasOnlyIgnorableTextNodes = (element: HTMLDivElement) => {
    return Array.from(element.childNodes).every((node) => {
        if (node.nodeType !== Node.TEXT_NODE) {
            return false;
        }

        return !node.textContent?.trim();
    });
};

const isInlineContentNode = (node: ChildNode) => {
    if (node.nodeType === Node.TEXT_NODE) {
        return true;
    }

    if (!(node instanceof HTMLElement)) {
        return false;
    }

    return !BLOCK_TAGS.has(node.tagName);
};

const flushInlineNodesAsParagraph = (fragment: DocumentFragment, inlineNodes: ChildNode[]) => {
    const hasMeaningfulContent = inlineNodes.some((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            return !!node.textContent?.trim();
        }

        return true;
    });

    if (!hasMeaningfulContent) {
        inlineNodes.forEach((node) => fragment.appendChild(node));
        inlineNodes.length = 0;
        return;
    }

    const paragraph = document.createElement('p');

    inlineNodes.forEach((node) => {
        paragraph.appendChild(node);
    });

    inlineNodes.length = 0;
    fragment.appendChild(paragraph);
};

const normalizeGenericDiv = (element: HTMLDivElement) => {
    const fragment = document.createDocumentFragment();
    const inlineNodes: ChildNode[] = [];

    Array.from(element.childNodes).forEach((node) => {
        if (isInlineContentNode(node)) {
            inlineNodes.push(node);
            return;
        }

        flushInlineNodesAsParagraph(fragment, inlineNodes);
        fragment.appendChild(node);
    });

    flushInlineNodesAsParagraph(fragment, inlineNodes);

    return fragment;
};

export function normalizeSourceHTML(html: string) {
    if (typeof window === 'undefined' || !html) {
        return html;
    }

    const template = document.createElement('template');
    template.innerHTML = html;

    template.content.querySelectorAll('a[style]').forEach((link) => {
        const sanitizedStyle = sanitizeLinkStyle(link.getAttribute('style'));

        if (!sanitizedStyle) {
            link.removeAttribute('style');
            return;
        }

        link.setAttribute('style', sanitizedStyle);
    });

    // source mode에서 붙여 넣은 레이아웃용 wrapper div 중 Tiptap schema가 이해하지 못하는
    // 일반 컨테이너는 벗겨내고 내부 block 콘텐츠만 유지한다.
    // 추후 필요해지면 특정 data-* wrapper 보존 규칙이나 다른 block 정규화 규칙도
    // 이 단계에서 함께 확장할 수 있다.
    const genericDivContainers = Array.from(template.content.querySelectorAll('div')).reverse();

    genericDivContainers.forEach((div) => {
        if (
            !(div instanceof HTMLDivElement) ||
            isPreservedContainer(div) ||
            hasOnlyIgnorableTextNodes(div)
        ) {
            return;
        }

        div.replaceWith(normalizeGenericDiv(div));
    });

    // 현재는 소스 모드에서 Tiptap TableKit이 다시 읽을 수 있는 형태로 표 HTML을 정규화한다.
    // 추후 필요해지면 링크, 미디어, 커스텀 블록 등 다른 확장에 대한 정규화 로직도
    // 같은 파일 안에서 단계적으로 추가할 수 있도록 source HTML 전체를 대상으로 처리한다.
    const tables = template.content.querySelectorAll('table');

    tables.forEach((table) => {
        const colWidths = Array.from(table.children)
            .filter((child): child is HTMLTableColElement => child.tagName === 'COLGROUP')
            .flatMap((colGroup) =>
                Array.from(colGroup.children).map((col) => {
                    if (!(col instanceof HTMLTableColElement)) {
                        return null;
                    }

                    // TableKit이 기본으로 생성하는 min-width(예: 25px)는
                    // 아직 사용자가 정한 컬럼 폭이 아니라 최소 폭 정보이므로
                    // source mode 왕복 시 실제 colwidth로 승격하면 안 된다.
                    return extractExplicitColWidth(col);
                }),
            );

        Array.from(table.children).forEach((child) => {
            if (!['THEAD', 'TBODY', 'TFOOT'].includes(child.tagName)) {
                return;
            }

            while (child.firstChild) {
                table.insertBefore(child.firstChild, child);
            }

            child.remove();
        });

        if (colWidths.length > 0) {
            const rows = Array.from(table.children).filter(
                (child): child is HTMLTableRowElement => child.tagName === 'TR',
            );

            rows.forEach((row) => {
                let columnIndex = 0;

                Array.from(row.children).forEach((cell) => {
                    if (!(cell instanceof HTMLTableCellElement)) {
                        return;
                    }

                    const colspan = Math.max(
                        Number.parseInt(cell.getAttribute('colspan') ?? '1', 10) || 1,
                        1,
                    );

                    if (!cell.getAttribute('colwidth')) {
                        const widthValues = colWidths
                            .slice(columnIndex, columnIndex + colspan)
                            .filter((width): width is number => width !== null);

                        if (widthValues.length === colspan && widthValues.length > 0) {
                            cell.setAttribute('colwidth', widthValues.join(','));
                        }
                    }

                    columnIndex += colspan;
                });
            });
        }

        Array.from(table.children).forEach((child) => {
            if (child.tagName === 'COLGROUP') {
                child.remove();
            }
        });
    });

    return template.innerHTML;
}
