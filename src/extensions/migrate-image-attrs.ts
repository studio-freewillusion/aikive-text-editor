/**
 * 이미지 attrs 마이그레이션
 * JSON 콘텐츠 내 image 노드를 순회하며
 * 기존 style / containerStyle 기반 포맷을 현재 구조화된 이미지 포맷으로 변환한다.
 *
 * Old examples:
 * - style: "width: 374px; ..."
 * - width: "374", containerStyle: "position: relative; width: 374px; margin: 0 auto;"
 *
 * New format:
 * - displayWidth / imageHeight / objectFit / objectPosition / borderRadius / margin
 */

type TiptapNode = {
    type?: string;
    attrs?: Record<string, unknown>;
    content?: TiptapNode[];
};

const parseStyleString = (style: string | null | undefined) => {
    if (typeof document === 'undefined' || !style?.trim()) {
        return null;
    }

    const element = document.createElement('div');
    element.style.cssText = style;
    return element.style;
};

const normalizeDimensionValue = (value: string | null | undefined) => {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();

    if (!trimmed) {
        return null;
    }

    if (/^\d+(\.\d+)?$/.test(trimmed)) {
        return `${trimmed}px`;
    }

    return trimmed;
};

const extractWidthFromValue = (value: unknown): string | null => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return `${Math.round(value)}`;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const match = value.match(/(\d+(?:\.\d+)?)px/i) ?? value.match(/^(\d+(?:\.\d+)?)$/);
    return match ? `${Math.round(Number.parseFloat(match[1]))}` : null;
};

const pickMargin = (style: CSSStyleDeclaration | null) => {
    if (!style) {
        return null;
    }

    if (style.margin?.trim()) {
        return style.margin.trim();
    }

    const values = [
        style.marginTop?.trim(),
        style.marginRight?.trim(),
        style.marginBottom?.trim(),
        style.marginLeft?.trim(),
    ];

    if (!values.some(Boolean)) {
        return null;
    }

    return values.map((value) => value || '0px').join(' ');
};

const resolveImageAttrs = (attrs: Record<string, unknown>) => {
    const rawStyle = typeof attrs.style === 'string' ? attrs.style : null;
    const containerStyleText =
        typeof attrs.containerStyle === 'string' ? attrs.containerStyle : null;
    const imageStyle = parseStyleString(rawStyle);
    const containerStyle = parseStyleString(containerStyleText);
    const displayWidth =
        normalizeDimensionValue(
            typeof attrs.displayWidth === 'string' ? attrs.displayWidth : null,
        ) ??
        normalizeDimensionValue(imageStyle?.width) ??
        normalizeDimensionValue(containerStyle?.width) ??
        normalizeDimensionValue(
            typeof attrs.width === 'string' || typeof attrs.width === 'number'
                ? String(attrs.width)
                : null,
        );
    const width =
        extractWidthFromValue(attrs.width) ??
        extractWidthFromValue(displayWidth) ??
        extractWidthFromValue(containerStyle?.width);
    const imageHeight =
        normalizeDimensionValue(typeof attrs.imageHeight === 'string' ? attrs.imageHeight : null) ??
        normalizeDimensionValue(imageStyle?.height);
    const margin =
        (typeof attrs.margin === 'string' && attrs.margin.trim() ? attrs.margin : null) ??
        pickMargin(imageStyle) ??
        pickMargin(containerStyle);

    return {
        width,
        displayWidth,
        imageHeight,
        objectFit:
            (typeof attrs.objectFit === 'string' && attrs.objectFit.trim()
                ? attrs.objectFit
                : null) ??
            imageStyle?.objectFit?.trim() ??
            null,
        objectPosition:
            (typeof attrs.objectPosition === 'string' && attrs.objectPosition.trim()
                ? attrs.objectPosition
                : null) ??
            imageStyle?.objectPosition?.trim() ??
            null,
        borderRadius:
            (typeof attrs.borderRadius === 'string' && attrs.borderRadius.trim()
                ? attrs.borderRadius
                : null) ??
            imageStyle?.borderRadius?.trim() ??
            null,
        margin,
    };
};

const migrateImageNode = (node: TiptapNode): TiptapNode => {
    if (node.type !== 'image' || !node.attrs) return node;

    const { attrs } = node;
    const resolved = resolveImageAttrs(attrs);

    return {
        ...node,
        attrs: {
            src: attrs.src,
            alt: attrs.alt ?? null,
            title: attrs.title ?? null,
            width: resolved.width,
            height: null,
            displayWidth: resolved.displayWidth,
            imageHeight: resolved.imageHeight,
            objectFit: resolved.objectFit,
            objectPosition: resolved.objectPosition,
            borderRadius: resolved.borderRadius,
            margin: resolved.margin,
            href: attrs.href ?? null,
            target: attrs.target ?? null,
        },
    };
};

const walkNodes = (nodes: TiptapNode[]): TiptapNode[] =>
    nodes.map((node) => {
        const migrated = migrateImageNode(node);
        if (migrated.content) {
            return { ...migrated, content: walkNodes(migrated.content) };
        }
        return migrated;
    });

export const migrateImageAttrs = (doc: Record<string, unknown>): Record<string, unknown> => {
    const typedDoc = doc as TiptapNode;
    if (!typedDoc.content || !Array.isArray(typedDoc.content)) return doc;
    return { ...typedDoc, content: walkNodes(typedDoc.content) };
};
