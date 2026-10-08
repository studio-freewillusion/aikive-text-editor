import { mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import type { DOMOutputSpec, Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorView, NodeView } from '@tiptap/pm/view';

import { normalizeImageHref, safeImageHref } from '../sanitize';

type ImageAttrs = {
    src?: string | null;
    alt?: string | null;
    title?: string | null;
    width?: string | number | null;
    height?: string | number | null;
    displayWidth?: string | null;
    imageHeight?: string | null;
    objectFit?: string | null;
    objectPosition?: string | null;
    borderRadius?: string | null;
    margin?: string | null;
    href?: string | null;
    target?: string | null;
};

const readParentLink = (element: HTMLElement) => {
    const anchor = element.parentElement;

    if (!anchor || anchor.tagName !== 'A') {
        return { href: null, target: null };
    }

    const href = safeImageHref(anchor.getAttribute('href'));

    return {
        href,
        target: href && anchor.getAttribute('target') === '_blank' ? '_blank' : null,
    };
};

type CustomImageOptions = {
    inline: boolean;
    allowBase64: boolean;
    HTMLAttributes: Record<string, unknown>;
    minWidth?: number;
    maxWidth?: number;
};

type ResizeLimits = {
    minWidth?: number;
    maxWidth?: number;
};

type ImageNodeViewContext = {
    node: ProseMirrorNode;
    editor: {
        options: {
            editable?: boolean;
        };
        view: EditorView;
    };
    view: EditorView;
    getPos?: (() => number) | boolean;
};

type ImageNodeViewElements = {
    wrapper: HTMLDivElement;
    container: HTMLDivElement;
    img: HTMLImageElement;
};

const compactStyle = (parts: Array<string | null | undefined>) =>
    parts
        .map((part) => part?.trim())
        .filter((part): part is string => !!part)
        .join('; ');

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

const extractPixelWidth = (value: string | number | null | undefined) => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return `${Math.round(value)}`;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const match = value.match(/(\d+(?:\.\d+)?)px/i) ?? value.match(/^(\d+(?:\.\d+)?)$/);

    if (!match) {
        return null;
    }

    return `${Math.round(Number.parseFloat(match[1]))}`;
};

const parseStyleString = (styleText: string | null | undefined) => {
    if (typeof document === 'undefined' || !styleText?.trim()) {
        return null;
    }

    const element = document.createElement('div');
    element.style.cssText = styleText;
    return element.style;
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

const readImageAttrsFromElement = (element: HTMLElement) => {
    const inlineStyle = element.style;
    const containerStyle = parseStyleString(element.getAttribute('containerstyle'));
    const widthFromStyle =
        normalizeDimensionValue(inlineStyle.width) ??
        normalizeDimensionValue(containerStyle?.width) ??
        normalizeDimensionValue(element.getAttribute('width'));

    const imageHeight =
        normalizeDimensionValue(inlineStyle.height) ??
        normalizeDimensionValue(element.getAttribute('height'));

    const margin = pickMargin(inlineStyle) ?? pickMargin(containerStyle);
    const width = extractPixelWidth(widthFromStyle ?? element.getAttribute('width'));

    return {
        width,
        displayWidth: widthFromStyle,
        imageHeight,
        objectFit: inlineStyle.objectFit?.trim() || null,
        objectPosition: inlineStyle.objectPosition?.trim() || null,
        borderRadius: inlineStyle.borderRadius?.trim() || null,
        margin,
    };
};

const buildImageStyle = ({
    imageHeight,
    objectFit,
    objectPosition,
    borderRadius,
}: Pick<ImageAttrs, 'imageHeight' | 'objectFit' | 'objectPosition' | 'borderRadius'>) =>
    compactStyle([
        'display: block',
        'width: 100%',
        imageHeight ? `height: ${imageHeight}` : 'height: auto',
        objectFit ? `object-fit: ${objectFit}` : null,
        objectPosition ? `object-position: ${objectPosition}` : null,
        borderRadius ? `border-radius: ${borderRadius}` : null,
    ]);

const buildHTMLImageStyle = ({
    displayWidth,
    imageHeight,
    objectFit,
    objectPosition,
    borderRadius,
    margin,
}: Pick<
    ImageAttrs,
    'displayWidth' | 'imageHeight' | 'objectFit' | 'objectPosition' | 'borderRadius' | 'margin'
>) =>
    compactStyle([
        'display: block',
        `width: ${displayWidth || '100%'}`,
        imageHeight ? `height: ${imageHeight}` : null,
        objectFit ? `object-fit: ${objectFit}` : null,
        objectPosition ? `object-position: ${objectPosition}` : null,
        borderRadius ? `border-radius: ${borderRadius}` : null,
        margin ? `margin: ${margin}` : null,
    ]);

const clampWidth = (width: number, limits: ResizeLimits) => {
    const absoluteMin = limits.minWidth !== undefined ? Math.max(0, limits.minWidth) : 0;
    let clampedWidth = Math.max(absoluteMin, width);

    if (limits.maxWidth !== undefined && clampedWidth > limits.maxWidth) {
        clampedWidth = limits.maxWidth;
    }

    return clampedWidth;
};

const getParentContentWidth = (element: HTMLElement) => {
    const parent = element.parentElement;

    if (!parent) {
        return null;
    }

    const parentRect = parent.getBoundingClientRect();

    if (!Number.isFinite(parentRect.width) || parentRect.width <= 0) {
        return null;
    }

    return Math.round(parentRect.width);
};

const resolveStoredDisplayWidth = (element: HTMLElement, fallbackWidth: number) => {
    const parentContentWidth = getParentContentWidth(element);

    if (parentContentWidth !== null && Math.abs(parentContentWidth - fallbackWidth) <= 1) {
        return '100%';
    }

    return element.style.width || `${fallbackWidth}px`;
};

class CustomImageNodeView implements NodeView {
    dom: HTMLDivElement;

    private context: ImageNodeViewContext;

    private resizeLimits: ResizeLimits;

    private elements: ImageNodeViewElements;

    private isResizing = false;

    private isDestroyed = false;

    private startX = 0;

    private startWidth = 0;

    private startHeight = 0;

    private shouldResizeHeight = false;

    private resizeMouseMoveHandler: ((event: MouseEvent) => void) | null = null;

    private resizeMouseUpHandler: (() => void) | null = null;

    constructor(context: ImageNodeViewContext, resizeLimits: ResizeLimits) {
        this.context = context;
        this.resizeLimits = resizeLimits;
        this.elements = {
            wrapper: document.createElement('div'),
            container: document.createElement('div'),
            img: document.createElement('img'),
        };
        this.dom = this.elements.wrapper;

        this.initialize();
    }

    update(node: ProseMirrorNode) {
        if (node.type !== this.context.node.type) {
            return false;
        }

        this.context.node = node;
        this.applyNodeAttrs();
        return true;
    }

    ignoreMutation() {
        return true;
    }

    destroy() {
        this.isDestroyed = true;
        document.removeEventListener('click', this.handleDocumentClick);

        if (this.resizeMouseMoveHandler) {
            document.removeEventListener('mousemove', this.resizeMouseMoveHandler);
            this.resizeMouseMoveHandler = null;
        }

        if (this.resizeMouseUpHandler) {
            document.removeEventListener('mouseup', this.resizeMouseUpHandler);
            this.resizeMouseUpHandler = null;
        }

        this.isResizing = false;
        this.shouldResizeHeight = false;
    }

    private initialize() {
        this.elements.wrapper.appendChild(this.elements.container);
        this.elements.container.appendChild(this.elements.img);
        this.applyNodeAttrs();

        if (!this.context.editor.options.editable) {
            return;
        }

        this.elements.container.addEventListener('click', () => {
            this.showControls();
        });

        document.addEventListener('click', this.handleDocumentClick);
    }

    private applyNodeAttrs() {
        const attrs = this.context.node.attrs as ImageAttrs;
        const displayWidth = attrs.displayWidth ?? (attrs.width ? `${attrs.width}px` : null);
        const margin = attrs.margin ?? null;

        this.elements.wrapper.style.display = 'flex';
        this.elements.wrapper.style.width = '100%';
        this.elements.wrapper.style.maxWidth = '100%';
        this.elements.container.style.position = 'relative';
        this.elements.container.style.width = displayWidth || '100%';
        this.elements.container.style.margin = margin || '';
        this.elements.img.style.cssText = buildImageStyle(attrs);

        if (attrs.src) {
            this.elements.img.setAttribute('src', attrs.src);
        }

        if (attrs.alt) {
            this.elements.img.setAttribute('alt', attrs.alt);
        } else {
            this.elements.img.removeAttribute('alt');
        }

        if (attrs.title) {
            this.elements.img.setAttribute('title', attrs.title);
        } else {
            this.elements.img.removeAttribute('title');
        }

        if (!this.context.editor.options.editable) {
            this.applyReadOnlyLink(attrs);
        }
    }

    // 노드 뷰는 링크를 속성으로만 들고 있어, 읽기 전용 화면에서는 직접 <a> 로 감싸야 눌러서 이동한다
    private applyReadOnlyLink(attrs: ImageAttrs) {
        const href = safeImageHref(attrs.href);
        const { img } = this.elements;
        const current = img.parentElement instanceof HTMLAnchorElement ? img.parentElement : null;

        if (!href) {
            current?.replaceWith(img);
            return;
        }

        const link = current ?? document.createElement('a');
        link.href = href;
        link.style.display = 'block';

        if (attrs.target === '_blank') {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        } else {
            link.removeAttribute('target');
            link.removeAttribute('rel');
        }

        if (!current) {
            img.replaceWith(link);
            link.appendChild(img);
        }
    }

    private hideControls = () => {
        this.clearSelectionStyle();
        Array.from(this.elements.container.querySelectorAll('[data-image-control]')).forEach(
            (element) => element.remove(),
        );
    };

    private showControls() {
        this.hideControls();
        this.elements.container.style.border = '1px dashed #6C6C6C';
        this.createPositionControls();
        this.createResizeHandles();
    }

    private clearSelectionStyle() {
        this.elements.container.style.border = '';
    }

    private handleDocumentClick = (event: MouseEvent) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
            return;
        }

        if (this.elements.wrapper.contains(target)) {
            return;
        }

        this.hideControls();
    };

    private createPositionControls() {
        const control = document.createElement('div');
        control.dataset.imageControl = 'position';
        control.style.cssText = compactStyle([
            'position: absolute',
            'top: 0',
            'left: 50%',
            'width: 130px',
            'height: 25px',
            'transform: translate(-50%, -50%)',
            'z-index: 999',
            'display: flex',
            'justify-content: space-between',
            'align-items: center',
            'padding: 0 6px',
            'border: 1px solid #6C6C6C',
            'border-radius: 3px',
            'background: #fff',
        ]);

        const buttons: Array<{ label: 'left' | 'center' | 'right'; margin: string }> = [
            { label: 'left', margin: '0 auto 0 0' },
            { label: 'center', margin: '0 auto' },
            { label: 'right', margin: '0 0 0 auto' },
        ];

        buttons.forEach(({ label, margin }) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.imageControl = 'button';
            button.style.cssText = compactStyle([
                'width: 24px',
                'height: 24px',
                'border: 0',
                'background: transparent',
                'display: inline-flex',
                'align-items: center',
                'justify-content: center',
                'padding: 0',
                'cursor: pointer',
            ]);
            button.appendChild(this.createAlignIcon(label));
            button.addEventListener('mouseover', () => {
                button.style.opacity = '0.6';
            });
            button.addEventListener('mouseout', () => {
                button.style.opacity = '1';
            });
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.elements.container.style.margin = margin;
                this.dispatchNodeView();
                this.showControls();
            });
            control.appendChild(button);
        });

        control.appendChild(this.createLinkButton());

        this.elements.container.appendChild(control);
    }

    // 버블 메뉴는 이미지를 고르면 숨으므로, 이미지 링크는 이 컨트롤 바에서만 걸 수 있다.
    private createLinkButton() {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.imageControl = 'button';
        button.title = '링크 연결';
        button.style.cssText = compactStyle([
            'width: 24px',
            'height: 24px',
            'border: 0',
            'background: transparent',
            'display: inline-flex',
            'align-items: center',
            'justify-content: center',
            'padding: 0',
            'cursor: pointer',
        ]);
        button.appendChild(this.createLinkIcon());
        button.addEventListener('mouseover', () => {
            button.style.opacity = '0.6';
        });
        button.addEventListener('mouseout', () => {
            button.style.opacity = '1';
        });
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.editImageLink();
        });

        return button;
    }

    private createLinkIcon() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', '#18181b');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.pointerEvents = 'none';

        [
            'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
            'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
        ].forEach((d) => {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            svg.appendChild(path);
        });

        return svg;
    }

    private editImageLink() {
        const { view, getPos } = this.context;

        if (typeof getPos !== 'function') {
            return;
        }

        const attrs = this.context.node.attrs as ImageAttrs;
        const url = window.prompt('URL', attrs.href ?? '');

        if (url === null) {
            return;
        }

        const href = url === '' ? null : normalizeImageHref(url);

        if (url !== '' && !href) {
            alert('유효하지 않은 URL 입니다. http:// 또는 https:// 주소만 넣을 수 있습니다.');

            return;
        }

        const target = href
            ? window.confirm('새 탭에서 열까요? (확인 = 새 탭, 취소 = 같은 탭)')
                ? '_blank'
                : null
            : null;

        this.hideControls();
        view.dispatch(view.state.tr.setNodeMarkup(getPos(), undefined, { ...attrs, href, target }));
    }

    private createAlignIcon(type: 'left' | 'center' | 'right') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.pointerEvents = 'none';

        const lineConfigs: Array<{ x: string; width: string; y: string }> =
            type === 'left'
                ? [
                      { x: '4', width: '16', y: '6' },
                      { x: '4', width: '11', y: '11' },
                      { x: '4', width: '16', y: '16' },
                  ]
                : type === 'center'
                  ? [
                        { x: '4', width: '16', y: '6' },
                        { x: '6.5', width: '11', y: '11' },
                        { x: '4', width: '16', y: '16' },
                    ]
                  : [
                        { x: '4', width: '16', y: '6' },
                        { x: '9', width: '11', y: '11' },
                        { x: '4', width: '16', y: '16' },
                    ];

        lineConfigs.forEach(({ x, width, y }) => {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', width);
            rect.setAttribute('height', '1.75');
            rect.setAttribute('rx', '1');
            rect.setAttribute('fill', '#18181b');
            svg.appendChild(rect);
        });

        return svg;
    }

    private createResizeHandles() {
        const positions = [
            'top: -4px; left: -4px; cursor: nwse-resize;',
            'top: -4px; right: -4px; cursor: nesw-resize;',
            'bottom: -4px; left: -4px; cursor: nesw-resize;',
            'bottom: -4px; right: -4px; cursor: nwse-resize;',
        ];

        positions.forEach((positionStyle, index) => {
            const dot = document.createElement('div');
            dot.dataset.imageControl = 'resize';
            dot.style.cssText = compactStyle([
                'position: absolute',
                'width: 9px',
                'height: 9px',
                'border: 1.5px solid #6C6C6C',
                'border-radius: 9999px',
                'background: #fff',
                positionStyle,
            ]);

            dot.addEventListener('mousedown', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.isResizing = true;
                this.startX = event.clientX;
                this.startWidth = this.elements.container.getBoundingClientRect().width;
                this.startHeight = this.elements.img.getBoundingClientRect().height;
                this.shouldResizeHeight = !!(
                    (this.context.node.attrs as ImageAttrs).imageHeight &&
                    this.startWidth > 0 &&
                    this.startHeight > 0
                );

                const onMouseMove = (moveEvent: MouseEvent) => {
                    if (!this.isResizing) {
                        return;
                    }

                    const parentContentWidth = getParentContentWidth(this.elements.wrapper);
                    const deltaX =
                        index % 2 === 0
                            ? -(moveEvent.clientX - this.startX)
                            : moveEvent.clientX - this.startX;
                    const maxWidth =
                        parentContentWidth === null
                            ? this.resizeLimits.maxWidth
                            : this.resizeLimits.maxWidth === undefined
                              ? parentContentWidth
                              : Math.min(this.resizeLimits.maxWidth, parentContentWidth);
                    const nextWidth = clampWidth(this.startWidth + deltaX, {
                        ...this.resizeLimits,
                        maxWidth,
                    });

                    this.elements.container.style.width = `${nextWidth}px`;

                    if (this.shouldResizeHeight) {
                        const nextHeight = Math.max(
                            1,
                            Math.round((this.startHeight * nextWidth) / this.startWidth),
                        );
                        this.elements.img.style.height = `${nextHeight}px`;
                    }
                };

                const onMouseUp = () => {
                    this.isResizing = false;
                    this.shouldResizeHeight = false;
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    this.resizeMouseMoveHandler = null;
                    this.resizeMouseUpHandler = null;

                    if (this.isDestroyed) {
                        return;
                    }

                    this.dispatchNodeView();
                    this.showControls();
                };

                this.resizeMouseMoveHandler = onMouseMove;
                this.resizeMouseUpHandler = onMouseUp;
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            this.elements.container.appendChild(dot);
        });
    }

    private dispatchNodeView() {
        const { view, getPos } = this.context;

        if (typeof getPos !== 'function') {
            return;
        }

        const width = Math.round(this.elements.container.getBoundingClientRect().width);
        const displayWidth = resolveStoredDisplayWidth(this.elements.container, width);
        const margin = this.elements.container.style.margin || null;
        const previousAttrs = this.context.node.attrs as ImageAttrs;
        const imageHeight =
            previousAttrs.imageHeight && this.elements.img.style.height
                ? this.elements.img.style.height
                : previousAttrs.imageHeight;
        const nextAttrs: ImageAttrs = {
            ...previousAttrs,
            width: `${width}`,
            displayWidth,
            imageHeight,
            margin,
        };

        this.hideControls();
        view.dispatch(view.state.tr.setNodeMarkup(getPos(), undefined, nextAttrs));
    }
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        imageLink: {
            setImageLink: (attrs: { href?: string | null; target?: string | null }) => ReturnType;
            unsetImageLink: () => ReturnType;
        };
    }
}

export const CustomImage = Image.extend<CustomImageOptions>({
    name: 'image',

    addOptions() {
        return {
            ...(this.parent?.() ?? {}),
            inline: false,
            allowBase64: false,
            HTMLAttributes: {},
            minWidth: undefined,
            maxWidth: undefined,
        };
    },

    addAttributes() {
        return {
            ...this.parent?.(),
            displayWidth: {
                default: null,
                parseHTML: (element: HTMLElement) =>
                    readImageAttrsFromElement(element).displayWidth,
            },
            imageHeight: {
                default: null,
                parseHTML: (element: HTMLElement) => readImageAttrsFromElement(element).imageHeight,
            },
            objectFit: {
                default: null,
                parseHTML: (element: HTMLElement) => readImageAttrsFromElement(element).objectFit,
            },
            objectPosition: {
                default: null,
                parseHTML: (element: HTMLElement) =>
                    readImageAttrsFromElement(element).objectPosition,
            },
            borderRadius: {
                default: null,
                parseHTML: (element: HTMLElement) =>
                    readImageAttrsFromElement(element).borderRadius,
            },
            margin: {
                default: null,
                parseHTML: (element: HTMLElement) => readImageAttrsFromElement(element).margin,
            },
            href: {
                default: null,
                parseHTML: (element: HTMLElement) => readParentLink(element).href,
                renderHTML: () => ({}),
            },
            target: {
                default: null,
                parseHTML: (element: HTMLElement) => readParentLink(element).target,
                renderHTML: () => ({}),
            },
            width: {
                default: null,
                parseHTML: (element: HTMLElement) => readImageAttrsFromElement(element).width,
                renderHTML: () => ({}),
            },
            height: {
                default: null,
                renderHTML: () => ({}),
            },
        };
    },

    renderHTML({ node, HTMLAttributes }) {
        const htmlAttributes = {
            ...(HTMLAttributes as ImageAttrs & Record<string, unknown>),
        };
        const nodeAttrs = node.attrs as ImageAttrs;
        const displayWidth = htmlAttributes.displayWidth;
        const imageHeight = htmlAttributes.imageHeight;
        const objectFit = htmlAttributes.objectFit;
        const objectPosition = htmlAttributes.objectPosition;
        const borderRadius = htmlAttributes.borderRadius;
        const margin = htmlAttributes.margin;
        const href = safeImageHref(nodeAttrs.href);
        const target = href && nodeAttrs.target === '_blank' ? '_blank' : null;

        delete htmlAttributes.displayWidth;
        delete htmlAttributes.imageHeight;
        delete htmlAttributes.objectFit;
        delete htmlAttributes.objectPosition;
        delete htmlAttributes.borderRadius;
        delete htmlAttributes.margin;
        delete htmlAttributes.width;
        delete htmlAttributes.height;

        const style = buildHTMLImageStyle({
            displayWidth,
            imageHeight,
            objectFit,
            objectPosition,
            borderRadius,
            margin,
        });

        const image: DOMOutputSpec = [
            'img',
            mergeAttributes(this.options.HTMLAttributes, htmlAttributes, style ? { style } : {}),
        ];

        if (!href) {
            return image;
        }

        const link: DOMOutputSpec = [
            'a',
            {
                href,
                ...(target ? { target, rel: 'noopener noreferrer' } : {}),
            },
            image,
        ];

        return link;
    },

    addCommands() {
        return {
            setImageLink:
                ({ href, target }: { href?: string | null; target?: string | null }) =>
                ({ commands }) => {
                    const safeHref = normalizeImageHref(href);

                    if (!safeHref) {
                        return false;
                    }

                    return commands.updateAttributes(this.name, {
                        href: safeHref,
                        target: target === '_blank' ? '_blank' : null,
                    });
                },
            unsetImageLink:
                () =>
                ({ commands }) =>
                    commands.updateAttributes(this.name, { href: null, target: null }),
        };
    },

    addNodeView() {
        return ({ node, editor, getPos }) => {
            const safeGetPos =
                typeof getPos === 'function'
                    ? () => {
                          const pos = getPos();

                          if (typeof pos !== 'number') {
                              throw new Error('image node position is not available');
                          }

                          return pos;
                      }
                    : undefined;

            return new CustomImageNodeView(
                {
                    node,
                    editor,
                    view: editor.view,
                    getPos: safeGetPos,
                },
                {
                    minWidth: this.options.minWidth,
                    maxWidth: this.options.maxWidth,
                },
            );
        };
    },
});
