import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { useEffect, useRef, useState } from 'react';
import { usePopoverPosition, type PopoverAnchor } from './input-popover';

export const PASTE_CHOICES = [
  { key: 'embed', label: '플레이어로 넣기' },
  { key: 'link', label: '링크로 두기' },
] as const;

const LINK_INDEX = 1;

export interface PasteChoiceProps {
  editor: Editor;
  anchor: () => PopoverAnchor;
  onEmbed: () => void;
  onClose: () => void;
}

export function PasteChoice({ editor, anchor, onEmbed, onClose }: PasteChoiceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const style = usePopoverPosition(ref, anchor);
  const [active, setActive] = useState(LINK_INDEX);
  const activeRef = useRef(active);
  activeRef.current = active;
  const runRef = useRef<(index: number) => void>(() => {});
  runRef.current = (index) => (index === LINK_INDEX ? onClose() : onEmbed());

  // 이어 쓰기·커서 이동·본문 교체·포커스 이동은 「링크로 두기」 와 같다
  useEffect(() => {
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.docChanged || transaction.selectionSet) onClose();
    };
    editor.on('transaction', onTransaction);
    editor.on('blur', onClose);
    return () => {
      editor.off('transaction', onTransaction);
      editor.off('blur', onClose);
    };
  }, [editor, onClose]);

  useEffect(() => {
    const onPointerDown = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [onClose]);

  // 포커스는 본문에 둔 채 고른다. 바깥 다이얼로그는 document 캡처로 Esc 를 먼저 받으므로 window 캡처에서 끊는다
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!editor.view.dom.contains(e.target as Node)) return;
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === 'Escape') {
        stop();
        onClose();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        stop();
        setActive((i) => (e.key === 'ArrowUp' ? Math.max(0, i - 1) : Math.min(PASTE_CHOICES.length - 1, i + 1)));
      } else if (e.key === 'Enter' && !e.isComposing) {
        stop();
        runRef.current(activeRef.current);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [editor, onClose]);

  // 항목 mousedown 을 막아 본문 포커스를 지킨다 — 포커스가 옮겨 가면 blur 로 창이 먼저 닫힌다
  return (
    <div ref={ref} role="menu" aria-label="붙여넣기 방식" className="aikive-popover aikive-paste-choice" style={style}>
      {PASTE_CHOICES.map((choice, index) => (
        <button
          key={choice.key}
          type="button"
          role="menuitem"
          className={index === active ? 'is-active' : undefined}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setActive(index)}
          onClick={() => runRef.current(index)}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}
