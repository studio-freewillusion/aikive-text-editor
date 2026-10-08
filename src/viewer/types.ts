export type ImageSrcResolver = (src: string) => string;

export type TiptapMark = { type: string; attrs?: Record<string, any> };

export interface TiptapNode {
    type?: string;
    text?: string;
    content?: TiptapNode[];
    attrs?: Record<string, any>;
    marks?: TiptapMark[];
}

export interface RenderOptions {
    onClickImage?: (src: string) => void;
    lazyMedia?: boolean;
    // 이미지 리사이즈 주소 규칙은 운영 호스트를 담고 있어 쓰는 쪽이 넘긴다
    resolveImageSrc: (src: string) => string;
}
