import { useEditorState, type Editor } from '@tiptap/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { ResolvedPos } from '@tiptap/pm/model';
import type { ColorOption, Features } from '../editor/types';
import type { PopoverKind } from '../extensions/input-popover-bridge';
import { Bold, Code2, Italic, Link, Palette, Redo2, Strikethrough, Underline, Undo2 } from './icons';

export interface ToolbarProps {
  editor: Editor;
  features: Required<Features>;
  sourceMode: boolean;
  onToggleSource: () => void;
  onPickImage?: () => void;
  onOpenPopover: (kind: PopoverKind) => void;
  scrollable?: boolean;
  colors?: ColorOption[];
  uploading?: boolean;
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

// 말풍선 툴바가 본문 폭 안에 들어가도록 블록 종류·정렬·넣기를 선택 상자 하나씩으로 묶었다
type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet' | 'ordered' | 'quote' | 'code';

const BLOCK_TYPES: Array<{ value: BlockType; label: string; feature: 'heading' | 'list' | 'blocks' | null }> = [
  { value: 'paragraph', label: '본문', feature: null },
  { value: 'h1', label: '제목 1', feature: 'heading' },
  { value: 'h2', label: '제목 2', feature: 'heading' },
  { value: 'h3', label: '제목 3', feature: 'heading' },
  { value: 'bullet', label: '글머리 목록', feature: 'list' },
  { value: 'ordered', label: '번호 목록', feature: 'list' },
  { value: 'quote', label: '인용', feature: 'blocks' },
  { value: 'code', label: '코드 블록', feature: 'blocks' },
];

// 바깥 목록이 아니라 커서에 가장 가까운 조상으로 판정해야 글머리 목록 안 번호 하위 목록을 번호로 본다
function innermostBlockType($pos: ResolvedPos): BlockType {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    const name = node.type.name;
    if (name === 'codeBlock') return 'code';
    if (name === 'heading') return `h${node.attrs.level as 1 | 2 | 3}`;
    if (name === 'bulletList') return 'bullet';
    if (name === 'orderedList') return 'ordered';
    if (name === 'blockquote') return 'quote';
  }
  return 'paragraph';
}

const ALIGN_OPTIONS = [
  { value: 'left', label: '왼쪽' },
  { value: 'center', label: '가운데' },
  { value: 'right', label: '오른쪽' },
  { value: 'justify', label: '양쪽' },
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

export function Toolbar({ editor, features, sourceMode, onToggleSource, onPickImage, onOpenPopover, scrollable, colors, uploading }: ToolbarProps) {
  const [colorOpen, setColorOpen] = useState(false);
  const [paletteLeft, setPaletteLeft] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
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
      blockType: ((): BlockType => {
        const { $from, $to } = ed.state.selection;
        const from = innermostBlockType($from);
        // 시작과 끝 블록 종류가 다르면 섞인 선택이라 「본문」 으로 둔다
        return from === innermostBlockType($to) ? from : 'paragraph';
      })(),
      align: ALIGN_OPTIONS.find((o) => ed.isActive({ textAlign: o.value }))?.value ?? '',
      canUndo: ed.can().chain().undo().run(),
      canRedo: ed.can().chain().redo().run(),
      isLink: ed.isActive('link') || (ed.isActive('image') && !!ed.getAttributes('image').href),
      isTable: ed.isActive('table'),
      fontSize: (ed.getAttributes('textStyle').fontSize as string | undefined) ?? '',
      lineHeight: (ed.getAttributes('textStyle').lineHeight as string | undefined) ?? '',
    }),
  });

  const chain = () => editor.chain().focus();
  const blockTypes = BLOCK_TYPES.filter((t) => t.feature === null || features[t.feature]);
  const setBlockType = (value: BlockType) => {
    const isList = (t: BlockType) => t === 'bullet' || t === 'ordered';
    const { selection, doc } = editor.state;
    let hasCode = selection.$from.parent.type.name === 'codeBlock';
    doc.nodesBetween(selection.from, selection.to, (node) => {
      if (node.type.name === 'codeBlock') hasCode = true;
    });
    // 양 끝이 목록이면 그 자리에서 종류만 바꿔야 목록이 쪼개지거나 하위 목록 들여쓰기가 풀리지 않는다(코드 블록이 끼면 아래 경로로 줄바꿈을 지킨다)
    if (!hasCode && isList(value) && isList(innermostBlockType(selection.$from)) && isList(innermostBlockType(selection.$to))) {
      (value === 'bullet' ? chain().toggleBulletList() : chain().toggleOrderedList()).run();
      return;
    }
    // 코드 블록은 먼저 문단으로 바꿔야 줄바꿈이 <br> 로 남는다(clearNodes 만 거치면 줄바꿈 글자가 사라짐)
    const c = hasCode ? chain().setParagraph().clearNodes() : chain().clearNodes();
    if (value === 'h1' || value === 'h2' || value === 'h3') c.setHeading({ level: Number(value[1]) as 1 | 2 | 3 });
    else if (value === 'bullet') c.toggleBulletList();
    else if (value === 'ordered') c.toggleOrderedList();
    else if (value === 'quote') c.setBlockquote();
    else if (value === 'code') c.setCodeBlock();
    c.run();
  };
  const insertOptions = [
    features.table && !state.isTable && { value: 'table', label: '표' },
    features.blocks && { value: 'hr', label: '구분선' },
    features.youtube && { value: 'youtube', label: '유튜브' },
    features.image && onPickImage && { value: 'image', label: '이미지' },
  ].filter((o): o is { value: string; label: string } => !!o);
  const insert = (value: string) => {
    if (value === 'table') chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    else if (value === 'hr') chain().setHorizontalRule().run();
    else if (value === 'youtube') onOpenPopover('youtube');
    else if (value === 'image') onPickImage?.();
  };
  // 좁은 화면에서 툴바 상자 오른쪽 밖으로 나가지 않게 연 뒤 폭을 재서 당긴다
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const palette = paletteRef.current;
    if (!colorOpen || !wrap || !palette) return;
    const max = wrap.clientWidth - palette.offsetWidth;
    setPaletteLeft((left) => Math.max(0, Math.min(left, max)));
  }, [colorOpen]);
  // 팔레트는 밀어서 넘기는 툴바(overflow) 밖에 그려야 잘리지 않아 버튼 위치를 재서 맞춘다
  const toggleColor = (e: MouseEvent<HTMLButtonElement>) => {
    const wrap = wrapRef.current;
    if (wrap) setPaletteLeft(e.currentTarget.getBoundingClientRect().left - wrap.getBoundingClientRect().left);
    setColorOpen((v) => !v);
  };

  return (
    <div ref={wrapRef} className="aikive-toolbar-wrap">
      <div
        ref={barRef}
        className={cx('aikive-toolbar', scrollable && 'is-scrollable', fade.start && 'is-fade-start', fade.end && 'is-fade-end')}
        role="toolbar"
        aria-label="서식"
        onScroll={
          scrollable
            ? () => {
                updateFade();
                setColorOpen(false);
              }
            : undefined
        }
      >
        {blockTypes.length > 1 && (
          <select
            aria-label="문단 종류"
            className="aikive-toolbar__select"
            value={state.blockType}
            onChange={(e) => setBlockType(e.target.value as BlockType)}
          >
            {blockTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
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
          <button
            type="button"
            aria-label="글자색"
            title="글자색"
            aria-pressed={colorOpen}
            className="aikive-toolbar__button"
            onClick={toggleColor}
          >
            <Palette />
          </button>
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
        {features.align && (
          <select
            aria-label="정렬"
            className="aikive-toolbar__select"
            value={state.align}
            onChange={(e) => (e.target.value ? chain().setTextAlign(e.target.value).run() : chain().unsetTextAlign().run())}
          >
            <option value="">정렬</option>
            {ALIGN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {features.link && (
          <ToolButton label="링크 연결" active={state.isLink} onClick={() => onOpenPopover('link')}>
            <Link />
          </ToolButton>
        )}
        {insertOptions.length > 0 && (
          <select
            aria-label="넣기"
            className="aikive-toolbar__select"
            value=""
            onChange={(e) => {
              if (e.target.value) insert(e.target.value);
            }}
          >
            <option value="">넣기</option>
            {insertOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {features.table && state.isTable && (
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
        )}
        {features.sourceMode && (
          <ToolButton label="HTML 모드" pressed={sourceMode} disabled={uploading && !sourceMode} onClick={onToggleSource}>
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
      {features.color && (
        <div ref={paletteRef} className="aikive-toolbar__palette" hidden={!colorOpen} style={{ left: paletteLeft }}>
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
          <input type="color" aria-label="글자색 직접 고르기" onChange={(e) => chain().setColor(e.target.value).run()} />
        </div>
      )}
    </div>
  );
}
