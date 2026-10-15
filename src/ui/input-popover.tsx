import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
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
  const preferred = below + size.height > viewport.height && above >= 0 ? above : below;
  const top = Math.max(EDGE, Math.min(preferred, viewport.height - size.height - EDGE));
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
      const rect = el.getBoundingClientRect();
      // transform 된 조상(다이얼로그 등) 안에서는 fixed 기준이 화면이 아니다 — 지금 그려진 위치와 style 값의 차이로 기준점을 잰다
      const originX = rect.left - (Number.parseFloat(el.style.left) || 0);
      const originY = rect.top - (Number.parseFloat(el.style.top) || 0);
      const target = placePopover(
        anchor(),
        { width: el.offsetWidth, height: el.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
      );
      setPos({ top: target.top - originY, left: target.left - originX });
    };
    place();
    // 오류 줄 등으로 창 높이가 바뀌면 위로 연 창이 고른 글자를 가리므로 다시 잡는다
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    if (ref.current) observer?.observe(ref.current);
    window.addEventListener('resize', place);
    // 본문을 감싼 스크롤 영역이 움직여도 따라가도록 캡처로 받는다
    window.addEventListener('scroll', place, true);
    return () => {
      observer?.disconnect();
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

  // 열려 있는 동안 업로드 등이 선택을 옮겨도 적용은 열 때 고른 곳에 한다
  const bookmark = useRef(editor.state.selection.getBookmark());
  useEffect(() => {
    const follow = ({ transaction, appendedTransactions }: { transaction: Transaction; appendedTransactions: Transaction[] }) => {
      bookmark.current = [transaction, ...appendedTransactions].reduce((mark, tr) => mark.map(tr.mapping), bookmark.current);
    };
    editor.on('transaction', follow);
    return () => {
      editor.off('transaction', follow);
    };
  }, [editor]);
  const restoreSelection = () => {
    try {
      editor.view.dispatch(editor.state.tr.setSelection(bookmark.current.resolve(editor.state.doc)));
    } catch {
      // 본문이 통째로 바뀌어 예전 위치가 없으면 지금 선택에 적용한다
    }
  };

  // 바깥 다이얼로그(Radix 등)는 document 캡처로 Esc 를 받아 창보다 먼저 닫힌다 — window 캡처에서 먼저 끊는다
  useEffect(() => {
    const onEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || !ref.current?.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      restoreSelection();
      onClose(true);
    };
    window.addEventListener('keydown', onEscape, true);
    return () => window.removeEventListener('keydown', onEscape, true);
  }, [onClose]);

  // 체크박스 등에서 누른 Enter 도 바깥 form 을 제출하지 않게 한다
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) e.preventDefault();
  };

  // 키보드로 창 밖에 포커스가 가면 닫는다. 갈 곳이 없는 blur(Safari 는 버튼을 눌러도 포커스를 주지 않음)는 바깥 클릭 처리에 맡긴다
  const onBlur = (e: FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && !ref.current?.contains(next)) onClose(false);
  };

  const done = () => onClose(true);
  let body: ReactNode = null;
  if (kind === 'link') body = <LinkForm editor={editor} prepare={restoreSelection} onDone={done} />;
  if (kind === 'youtube') body = <YoutubeForm editor={editor} prepare={restoreSelection} onDone={done} />;
  if (kind === 'alt') body = <AltForm editor={editor} prepare={restoreSelection} onDone={done} />;
  // 처음부터 숨겨 두면 autoFocus 가 실패한다 — 0,0 에 그린 뒤 화면에 보이기 전에 layout effect 가 옮긴다
  const style = pos ?? { top: 0, left: 0 };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={LABELS[kind]}
      tabIndex={-1}
      className="aikive-popover"
      style={style}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      {body}
    </div>
  );
}

interface FormProps {
  editor: Editor;
  prepare: () => void;
  onDone: () => void;
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
  // 바깥 form 제출을 막고, 한글 조합을 끝내는 Enter 는 적용으로 치지 않는다
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.nativeEvent.isComposing) onEnter();
  };
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
        onKeyDown={onKeyDown}
      />
      {error && (
        <p id={errorId} className="aikive-popover__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function LinkForm({ editor, prepare, onDone }: FormProps) {
  const [current] = useState(() => currentLink(editor));
  const [url, setUrl] = useState(current?.href ?? '');
  const [newTab, setNewTab] = useState(current ? current.newTab : true);
  const [error, setError] = useState('');
  const apply = () => {
    prepare();
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
                prepare();
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

function YoutubeForm({ editor, prepare, onDone }: FormProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const apply = () => {
    prepare();
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

function AltForm({ editor, prepare, onDone }: FormProps) {
  const [value, setValue] = useState(() => (editor.getAttributes('image').alt as string | undefined) ?? '');
  const apply = () => {
    prepare();
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
