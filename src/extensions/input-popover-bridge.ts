import { Extension } from '@tiptap/core';

export type PopoverKind = 'link' | 'youtube' | 'alt';

export interface InputPopoverBridgeStorage {
  open: ((kind: PopoverKind, pos?: number) => boolean) | null;
}

// 이미지 조작 바(일반 DOM)와 단축키가 React 쪽 입력 창을 열 수 있게 에디터 컴포넌트가 open 을 채운다
export const InputPopoverBridge = Extension.create<Record<string, never>, InputPopoverBridgeStorage>({
  name: 'inputPopoverBridge',
  addStorage() {
    return { open: null };
  },
  addKeyboardShortcuts() {
    return { 'Mod-k': () => this.storage.open?.('link') ?? false };
  },
});

export const openInputPopover = (editor: { storage: unknown }, kind: PopoverKind, pos?: number): boolean =>
  (editor.storage as { inputPopoverBridge?: InputPopoverBridgeStorage }).inputPopoverBridge?.open?.(kind, pos) ?? false;
