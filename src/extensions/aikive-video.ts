import { Node } from '@tiptap/core';
import { isAikiveEmbedSrc } from '../sanitize';

export interface AikiveVideoOptions {
  hosts: string[];
}

export const AIKIVE_VIDEO_IFRAME_ATTRS = {
  allow: 'autoplay; fullscreen; picture-in-picture; encrypted-media',
  allowfullscreen: 'true',
  loading: 'lazy',
  referrerpolicy: 'strict-origin-when-cross-origin',
} as const;

export const AikiveVideo = Node.create<AikiveVideoOptions>({
  name: 'aikiveVideo',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { hosts: [] };
  },

  addAttributes() {
    return { src: { default: null } };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-aikive-video]',
        getAttrs: (el) => {
          const src = (el as HTMLElement).querySelector('iframe')?.getAttribute('src') ?? '';
          return isAikiveEmbedSrc(src, this.options.hosts) ? { src } : false;
        },
      },
    ];
  },

  renderHTML({ node }) {
    return ['div', { 'data-aikive-video': '' }, ['iframe', { src: node.attrs.src, ...AIKIVE_VIDEO_IFRAME_ATTRS }]];
  },

  // 글쓴이가 에디터 안에서 재생해도 조회로 세지 않도록 임베드 화면에 미리 보기 표시를 넘긴다 — 저장 HTML 에는 넣지 않는다
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.setAttribute('data-aikive-video', '');
      const iframe = document.createElement('iframe');
      for (const [name, value] of Object.entries(AIKIVE_VIDEO_IFRAME_ATTRS)) iframe.setAttribute(name, value);
      iframe.setAttribute('src', `${node.attrs.src}?preview=1`);
      dom.appendChild(iframe);
      return { dom };
    };
  },
});
