import Youtube from '@tiptap/extension-youtube';

// 3.31 은 주소를 읽을 때 정규화해 저장 때 controls=0 을 붙이고 si·t 를 지운다 — 기존 글을 열고 저장해도 주소가 그대로이도록 3.20 의 속성 정의로 되돌린다
export const StoredYoutube = Youtube.extend({
  addAttributes() {
    return {
      src: { default: null },
      start: { default: 0 },
      width: { default: this.options.width },
      height: { default: this.options.height },
    };
  },
});
