import { useEditorState, type Editor } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ColorOption, Features } from '../editor/types';
import type { PopoverKind } from '../extensions/input-popover-bridge';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link,
  List,
  ListOrdered,
  Palette,
  Redo2,
  Strikethrough,
  Table2,
  Underline,
  Undo2,
  Youtube,
} from './icons';

export interface ToolbarProps {
  editor: Editor;
  features: Required<Features>;
  sourceMode: boolean;
  onToggleSource: () => void;
  onPickImage?: () => void;
  onOpenPopover: (kind: PopoverKind) => void;
  scrollable?: boolean;
  colors?: ColorOption[];
}

const FONT_SIZE_OPTIONS = ['10px', '11px', '12px', '14px', '16px', '18px', '21px', '24px', '36px', '48px', '60px', '72px'];

const LINE_HEIGHT_OPTIONS = [
  { label: '1.0', value: '1' },
  { label: '1.5', value: '1.5' },
  { label: '2.0', value: '2' },
];

const COLOR_OPTIONS = [
  { label: '검정', value: '#111111' },
  { label: '회색', value: '#6b7280' },
  { label: '빨강', value: '#dc2626' },
  { label: '주황', value: '#ea580c' },
  { label: '노랑', value: '#ca8a04' },
  { label: '초록', value: '#16a34a' },
  { label: '파랑', value: '#2563eb' },
  { label: '남색', value: '#4338ca' },
  { label: '보라', value: '#7c3aed' },
];

const BLOCK_ACTIONS = [
  { value: 'toggleBlockquote', label: '인용' },
  { value: 'setHorizontalRule', label: '구분선' },
  { value: 'toggleCodeBlock', label: '코드 블록' },
] as const;

// 표 안에 커서가 있을 때만 뜨는 편집 목록 — 말풍선 메뉴가 좁아 select 하나로 묶었다
const TABLE_ACTIONS = [
  { value: 'addColumnBefore', label: '왼쪽 열 추가' },
  { value: 'addColumnAfter', label: '오른쪽 열 추가' },
  { value: 'deleteColumn', label: '열 삭제' },
  { value: 'addRowBefore', label: '위 행 추가' },
  { value: 'addRowAfter', label: '아래 행 추가' },
  { value: 'deleteRow', label: '행 삭제' },
  { value: 'mergeOrSplit', label: '셀 병합/분할' },
  { value: 'toggleHeaderRow', label: '헤더 행 전환' },
  { value: 'deleteTable', label: '표 삭제' },
] as const;

const cx = (...names: Array<string | false | undefined>) => names.filter(Boolean).join(' ');

function ToolButton({
  label,
  active,
  disabled,
  pressed,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      className={cx('aikive-toolbar__button', active && 'is-active')}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Toolbar({ editor, features, sourceMode, onToggleSource, onPickImage, onOpenPopover, scrollable, colors }: ToolbarProps) {
  const [colorOpen, setColorOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ start: false, end: false });
  // 밀어서 넘기는 툴바는 막대를 숨기므로 더 넘길 쪽 끝을 흐려 버튼이 더 있음을 알린다
  const updateFade = useCallback(() => {
    const el = barRef.current;
    if (!el || !scrollable) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setFade((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [scrollable]);
  useEffect(() => {
    const el = barRef.current;
    if (!el || !scrollable) return;
    updateFade();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateFade);
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollable, updateFade]);
  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      isBold: ed.isActive('bold'),
      isItalic: ed.isActive('italic'),
      isStrike: ed.isActive('strike'),
      isUnderline: ed.isActive('underline'),
      isHeading1: ed.isActive('heading', { level: 1 }),
      isHeading2: ed.isActive('heading', { level: 2 }),
      isHeading3: ed.isActive('heading', { level: 3 }),
      canUndo: ed.can().chain().undo().run(),
      canRedo: ed.can().chain().redo().run(),
      isLeft: ed.isActive({ textAlign: 'left' }),
      isCenter: ed.isActive({ textAlign: 'center' }),
      isRight: ed.isActive({ textAlign: 'right' }),
      isJustify: ed.isActive({ textAlign: 'justify' }),
      isLink: ed.isActive('link') || (ed.isActive('image') && !!ed.getAttributes('image').href),
      isTable: ed.isActive('table'),
      isBulletList: ed.isActive('bulletList'),
      isOrderedList: ed.isActive('orderedList'),
      fontSize: (ed.getAttributes('textStyle').fontSize as string | undefined) ?? '',
      lineHeight: (ed.getAttributes('textStyle').lineHeight as string | undefined) ?? '',
    }),
  });

  const chain = () => editor.chain().focus();

  return (
    <div
      ref={barRef}
      className={cx('aikive-toolbar', scrollable && 'is-scrollable', fade.start && 'is-fade-start', fade.end && 'is-fade-end')}
      role="toolbar"
      aria-label="서식"
      onScroll={scrollable ? updateFade : undefined}
    >
      {features.heading && (
        <>
          <ToolButton label="제목 1" active={state.isHeading1} onClick={() => chain().toggleHeading({ level: 1 }).run()}>
            <Heading1 />
          </ToolButton>
          <ToolButton label="제목 2" active={state.isHeading2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
            <Heading2 />
          </ToolButton>
          <ToolButton label="제목 3" active={state.isHeading3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
            <Heading3 />
          </ToolButton>
        </>
      )}
      <ToolButton label="굵게" active={state.isBold} onClick={() => chain().toggleBold().run()}>
        <Bold />
      </ToolButton>
      <ToolButton label="기울임꼴" active={state.isItalic} onClick={() => chain().toggleItalic().run()}>
        <Italic />
      </ToolButton>
      <ToolButton label="밑줄" active={state.isUnderline} onClick={() => chain().toggleUnderline().run()}>
        <Underline />
      </ToolButton>
      <ToolButton label="취소선" active={state.isStrike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough />
      </ToolButton>
      {features.color && (
        <div className="aikive-toolbar__color">
          <ToolButton label="글자색" pressed={colorOpen} onClick={() => setColorOpen((v) => !v)}>
            <Palette />
          </ToolButton>
          <div className="aikive-toolbar__palette" hidden={!colorOpen}>
            <button
              type="button"
              className="aikive-toolbar__swatch is-reset"
              aria-label="글자색 기본"
              onClick={() => chain().unsetColor().run()}
            >
              기본
            </button>
            {(colors ?? COLOR_OPTIONS).map((c) => (
              <button
                key={c.value}
                type="button"
                className="aikive-toolbar__swatch"
                aria-label={`글자색 ${c.label}`}
                title={c.label}
                style={{ backgroundColor: c.value }}
                onClick={() => chain().setColor(c.value).run()}
              />
            ))}
            <input
              type="color"
              aria-label="글자색 직접 고르기"
              onChange={(e) => chain().setColor(e.target.value).run()}
            />
          </div>
        </div>
      )}
      {features.align && (
        <>
          <ToolButton label="왼쪽 정렬" active={state.isLeft} onClick={() => chain().toggleTextAlign('left').run()}>
            <AlignLeft />
          </ToolButton>
          <ToolButton label="중앙 정렬" active={state.isCenter} onClick={() => chain().toggleTextAlign('center').run()}>
            <AlignCenter />
          </ToolButton>
          <ToolButton label="오른쪽 정렬" active={state.isRight} onClick={() => chain().toggleTextAlign('right').run()}>
            <AlignRight />
          </ToolButton>
          <ToolButton label="양쪽 정렬" active={state.isJustify} onClick={() => chain().toggleTextAlign('justify').run()}>
            <AlignJustify />
          </ToolButton>
        </>
      )}
      {features.fontSize && (
        <select
          aria-label="글자 크기"
          className="aikive-toolbar__select"
          value={state.fontSize}
          onChange={(e) => (e.target.value ? chain().setFontSize(e.target.value).run() : chain().unsetFontSize().run())}
        >
          <option value="">크기</option>
          {FONT_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size.replace('px', '')}
            </option>
          ))}
        </select>
      )}
      {features.lineHeight && (
        <select
          aria-label="줄간격"
          className="aikive-toolbar__select"
          value={state.lineHeight}
          onChange={(e) =>
            e.target.value ? chain().setLineHeight(e.target.value).run() : chain().unsetLineHeight().run()
          }
        >
          <option value="">줄간격</option>
          {LINE_HEIGHT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {features.list && (
        <>
          <ToolButton
            label="글머리 목록"
            active={state.isBulletList}
            pressed={state.isBulletList}
            onClick={() => chain().toggleBulletList().run()}
          >
            <List />
          </ToolButton>
          <ToolButton
            label="번호 목록"
            active={state.isOrderedList}
            pressed={state.isOrderedList}
            onClick={() => chain().toggleOrderedList().run()}
          >
            <ListOrdered />
          </ToolButton>
        </>
      )}
      {features.blocks && (
        <select
          aria-label="블록"
          className="aikive-toolbar__select"
          value=""
          onChange={(e) => {
            const action = e.target.value as (typeof BLOCK_ACTIONS)[number]['value'] | '';
            if (action) chain()[action]().run();
          }}
        >
          <option value="">블록</option>
          {BLOCK_ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      )}
      {features.table &&
        (state.isTable ? (
          <select
            aria-label="표 편집"
            className="aikive-toolbar__select"
            value=""
            onChange={(e) => {
              const action = e.target.value as (typeof TABLE_ACTIONS)[number]['value'] | '';
              if (action) chain()[action]().run();
            }}
          >
            <option value="">표 편집</option>
            {TABLE_ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        ) : (
          <ToolButton label="표 삽입" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <Table2 />
          </ToolButton>
        ))}
      {features.image && onPickImage && (
        <ToolButton label="이미지 넣기" onClick={onPickImage}>
          <ImageIcon />
        </ToolButton>
      )}
      {features.link && (
        <ToolButton label="링크 연결" active={state.isLink} onClick={() => onOpenPopover('link')}>
          <Link />
        </ToolButton>
      )}
      {features.youtube && (
        <ToolButton label="유튜브 넣기" onClick={() => onOpenPopover('youtube')}>
          <Youtube />
        </ToolButton>
      )}
      {features.sourceMode && (
        <ToolButton label="HTML 모드" pressed={sourceMode} onClick={onToggleSource}>
          <Code2 />
        </ToolButton>
      )}
      {features.undoRedo && (
        <>
          <ToolButton label="되돌리기" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
            <Undo2 />
          </ToolButton>
          <ToolButton label="다시 하기" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
            <Redo2 />
          </ToolButton>
        </>
      )}
    </div>
  );
}
