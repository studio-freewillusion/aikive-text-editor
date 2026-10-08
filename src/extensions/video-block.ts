// extensions/VideoBlock.ts
import { mergeAttributes, Node } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        videoBlock: {
            setVideoBlock: (attrs: Partial<VideoAttrs>) => ReturnType;
            updateVideoBlock: (attrs: Partial<VideoAttrs>) => ReturnType;
            removeVideoBlock: () => ReturnType;
        };
    }
}

export type VideoAttrs = {
    src: string | null;
    controls: boolean;
    autoplay: boolean;
    loop: boolean;
    muted: boolean;
    playsinline: boolean;
    poster: string | null;
    width: string | number | null;
    height: string | number | null;
};

const videoAttrsOf = (vid: HTMLVideoElement) => ({
    src: vid.getAttribute('src'),
    poster: vid.getAttribute('poster'),
    controls: true,
    autoplay: vid.hasAttribute('autoplay'),
    loop: vid.hasAttribute('loop'),
    muted: vid.hasAttribute('muted'),
    playsinline: true,
});

export const VideoBlock = Node.create({
    name: 'videoBlock',
    group: 'block',
    atom: true,
    draggable: true,
    selectable: true,

    addAttributes() {
        return {
            src: { default: null },
            controls: { default: true },
            autoplay: { default: false },
            loop: { default: false },
            muted: { default: false },
            playsinline: { default: true },
            poster: { default: null },
            width: { default: null },
            height: { default: null },
        };
    },

    // div[data-type=videoBlock] > video 구조와, video 단독 구조 모두 파싱
    parseHTML() {
        return [
            {
                tag: 'div[data-type="videoBlock"]',
                getAttrs: (el) => {
                    const vid = (el as HTMLElement).querySelector('video');
                    return vid ? videoAttrsOf(vid) : null;
                },
            },
            {
                tag: 'video',
                getAttrs: (el) => videoAttrsOf(el as HTMLVideoElement),
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const {
            controls,
            autoplay,
            loop,
            muted,
            playsinline,
            width,
            height,
            poster,
            src,
            ...rest
        } = HTMLAttributes;

        const wrapperStyleParts: string[] = [
            'display: flex',
            'justify-content: center',
            'align-items: center',
            'background-color: #000',
            'width: 100%',
        ];

        const wrapperAttrs: Record<string, any> = {
            'data-type': 'videoBlock',
            style: wrapperStyleParts.join('; '),
        };

        // 비디오는 wrapper를 100% 채우고 비율 유지 + 레터박스
        const videoStyleParts: string[] = [
            'display: block',
            'object-fit: contain', // 비율 유지(여백은 wrapper의 검정 배경)
            'background-color: #000',
            'max-width: 100%',
        ];

        const videoAttrs: Record<string, any> = {
            ...rest,
            ...(src ? { src } : {}),
            ...(poster ? { poster } : {}),
            ...(controls ? { controls: '' } : {}),
            ...(autoplay ? { autoplay: '' } : {}),
            ...(loop ? { loop: '' } : {}),
            ...(muted ? { muted: '' } : {}),
            ...(playsinline ? { playsinline: '' } : {}),
            style: videoStyleParts.join('; '),
            controlslist: 'nodownload',
            disablepictureinpicture: true,
        };

        return ['div', mergeAttributes(wrapperAttrs), ['video', mergeAttributes(videoAttrs)]];
    },

    addCommands() {
        return {
            setVideoBlock:
                (attrs) =>
                ({ chain }) =>
                    chain().insertContent({ type: this.name, attrs }).run(),

            updateVideoBlock:
                (attrs) =>
                ({ state, tr, dispatch }) => {
                    const { selection } = state;

                    if (
                        selection instanceof NodeSelection &&
                        selection.node.type.name === this.name
                    ) {
                        const pos = selection.from;
                        const node = selection.node;
                        const newNode = node.type.create({ ...node.attrs, ...attrs });
                        if (dispatch) {
                            tr.replaceWith(pos, pos + node.nodeSize, newNode);
                            tr.setSelection(NodeSelection.create(tr.doc, pos));
                            dispatch(tr);
                        }
                        return true;
                    }

                    const $from = selection.$from;
                    for (let d = $from.depth; d >= 0; d--) {
                        const node = $from.node(d);
                        if (node.type.name === this.name) {
                            const pos = d > 0 ? $from.before(d) : 0;
                            const newNode = node.type.create({ ...node.attrs, ...attrs });
                            if (dispatch) {
                                tr.replaceWith(pos, pos + node.nodeSize, newNode);
                                tr.setSelection(NodeSelection.create(tr.doc, pos));
                                dispatch(tr);
                            }
                            return true;
                        }
                    }
                    return false;
                },

            removeVideoBlock:
                () =>
                ({ state, tr, dispatch }) => {
                    const { selection } = state;

                    if (
                        selection instanceof NodeSelection &&
                        selection.node.type.name === this.name
                    ) {
                        const pos = selection.from;
                        if (dispatch) {
                            tr.delete(pos, pos + selection.node.nodeSize);
                            const safePos = Math.max(0, pos - 1);
                            tr.setSelection(TextSelection.create(tr.doc, safePos));
                            dispatch(tr);
                        }
                        return true;
                    }

                    const $from = state.selection.$from;
                    for (let d = $from.depth; d >= 0; d--) {
                        const node = $from.node(d);
                        if (node.type.name === this.name) {
                            const pos = d > 0 ? $from.before(d) : 0;
                            if (dispatch) {
                                tr.delete(pos, pos + node.nodeSize);
                                const safePos = Math.max(0, pos - 1);
                                tr.setSelection(TextSelection.create(tr.doc, safePos));
                                dispatch(tr);
                            }
                            return true;
                        }
                    }
                    return false;
                },
        };
    },
});
