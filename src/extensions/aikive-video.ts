import { Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
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

  // JSON 본문·명령으로 넣은 노드는 parseHTML 검사를 거치지 않아 그릴 때 다시 본다 — 아니면 빈 래퍼만 두고 다음에 열 때 지워진다
  renderHTML({ node }) {
    if (!isAikiveEmbedSrc(node.attrs.src ?? '', this.options.hosts)) return ['div', { 'data-aikive-video': '' }];
    return ['div', { 'data-aikive-video': '' }, ['iframe', { src: node.attrs.src, ...AIKIVE_VIDEO_IFRAME_ATTRS }]];
  },

  // 명령·JSON 으로 들어온 허용 밖 블록은 빈 칸으로 남기지 않고 바로 지운다
  addProseMirrorPlugins() {
    const { hosts } = this.options;
    const name = this.name;
    return [
      new Plugin({
        key: new PluginKey('aikiveVideoCleanup'),
        appendTransaction: (transactions, _old, state) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const invalid: Array<{ from: number; to: number }> = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === name && !isAikiveEmbedSrc(node.attrs.src ?? '', hosts)) {
              invalid.push({ from: pos, to: pos + node.nodeSize });
            }
          });
          if (!invalid.length) return null;
          const { tr } = state;
          for (const range of invalid.reverse()) tr.delete(range.from, range.to);
          return tr;
        },
      }),
    ];
  },

  // 에디터 안 표시는 미리 보기임을 임베드 화면에 알린다 — 저장 HTML 에는 넣지 않는다
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.setAttribute('data-aikive-video', '');
      if (!isAikiveEmbedSrc(node.attrs.src ?? '', this.options.hosts)) return { dom };
      const iframe = document.createElement('iframe');
      for (const [name, value] of Object.entries(AIKIVE_VIDEO_IFRAME_ATTRS)) iframe.setAttribute(name, value);
      iframe.setAttribute('src', `${node.attrs.src}?preview=1`);
      dom.appendChild(iframe);
      return { dom };
    };
  },
});
