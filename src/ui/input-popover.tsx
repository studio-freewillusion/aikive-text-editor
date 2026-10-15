import type { Editor } from '@tiptap/core';
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ALT_MAX_LENGTH, applyAlt, applyLink, currentLink, insertYoutube, removeLink } from '../editor/popover-actions';
import type { PopoverKind } from '../extensions/input-popover-bridge';

export interface PopoverAnchor {
  left: number;
  top: number;
  bottom: number;
}

const GAP = 8;
const EDGE = 8;

export function placePopover(
  anchor: PopoverAnchor,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
) {
  const below = anchor.bottom + GAP;
  const above = anchor.top - GAP - size.height;
  const top = below + size.height > viewport.height && above >= 0 ? above : below;
  const left = Math.max(EDGE, Math.min(anchor.left, viewport.width - size.width - EDGE));
  return { top, left };
}

const LABELS: Record<PopoverKind, string> = { link: '링크', youtube: '유튜브', alt: '대체 텍스트' };

export interface InputPopoverProps {
  editor: Editor;
  kind: PopoverKind;
  anchor: () => PopoverAnchor;
  onClose: (refocus: boolean) => void;
}

export function InputPopover({ editor, kind, anchor, onClose }: InputPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el) return;
      setPos(
        placePopover(
          anchor(),
          { width: el.offsetWidth, height: el.offsetHeight },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      );
    };
    place();
    window.addEventListener('resize', place);
    // 본문을 감싼 스크롤 영역이 움직여도 따라가도록 캡처로 받는다
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor]);

  useEffect(() => {
    const onPointerDown = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [onClose]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    onClose(true);
  };

  const done = () => onClose(true);
  // 처음 그릴 때 숨겨 두면 autoFocus 가 실패한다 — 위치는 그리기 전에 layout effect 가 잡으므로 숨기지 않는다
  let body: ReactNode = null;
  if (kind === 'link') body = <LinkForm editor={editor} onDone={done} />;
  if (kind === 'youtube') body = <YoutubeForm editor={editor} onDone={done} />;
  if (kind === 'alt') body = <AltForm editor={editor} onDone={done} />;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={LABELS[kind]}
      className="aikive-popover"
      style={pos ?? undefined}
      onKeyDown={onKeyDown}
    >
      {body}
    </div>
  );
}

export function PopoverField({
  label,
  value,
  error,
  maxLength,
  onChange,
  onEnter,
}: {
  label: string;
  value: string;
  error: string;
  maxLength?: number;
  onChange: (value: string) => void;
  onEnter: () => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="aikive-popover__field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        autoFocus
        value={value}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // 바깥 form 제출을 막고, 한글 조합을 끝내는 Enter 는 적용으로 치지 않는다
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (!e.nativeEvent.isComposing) onEnter();
        }}
      />
      {error && (
        <p id={errorId} className="aikive-popover__error">
          {error}
        </p>
      )}
    </div>
  );
}

function LinkForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const [current] = useState(() => currentLink(editor));
  const [url, setUrl] = useState(current?.href ?? '');
  const [newTab, setNewTab] = useState(current ? current.newTab : true);
  const [error, setError] = useState('');
  const apply = () => {
    const message = applyLink(editor, url, newTab);
    if (message) setError(message);
    else onDone();
  };
  return (
    <>
      <PopoverField
        label="주소"
        value={url}
        error={error}
        onChange={(value) => {
          setUrl(value);
          setError('');
        }}
        onEnter={apply}
      />
      <label className="aikive-popover__check">
        <input type="checkbox" checked={newTab} onChange={(e) => setNewTab(e.target.checked)} />새 탭에서 열기
      </label>
      <div className="aikive-popover__actions">
        {current && (
          <>
            <button type="button" onClick={() => window.open(current.href, '_blank', 'noopener,noreferrer')}>
              열기
            </button>
            <button
              type="button"
              onClick={() => {
                removeLink(editor);
                onDone();
              }}
            >
              링크 해제
            </button>
          </>
        )}
        <button type="button" className="is-primary" onClick={apply}>
          적용
        </button>
      </div>
    </>
  );
}

function YoutubeForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const apply = () => {
    const message = insertYoutube(editor, url);
    if (message) setError(message);
    else onDone();
  };
  return (
    <>
      <PopoverField
        label="유튜브 주소"
        value={url}
        error={error}
        onChange={(value) => {
          setUrl(value);
          setError('');
        }}
        onEnter={apply}
      />
      <div className="aikive-popover__actions">
        <button type="button" className="is-primary" onClick={apply}>
          넣기
        </button>
      </div>
    </>
  );
}

function AltForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const [value, setValue] = useState(() => (editor.getAttributes('image').alt as string | undefined) ?? '');
  const apply = () => {
    applyAlt(editor, value);
    onDone();
  };
  return (
    <>
      <PopoverField label="대체 텍스트" value={value} error="" maxLength={ALT_MAX_LENGTH} onChange={setValue} onEnter={apply} />
      <div className="aikive-popover__actions">
        <button type="button" className="is-primary" onClick={apply}>
          적용
        </button>
      </div>
    </>
  );
}
