import { EditorState, NodeSelection, PluginKey } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import DragHandle from '@tiptap/extension-drag-handle-react';
import { EditorContent, posToDOMRect, useEditor, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { GripVertical } from '../ui/icons';
import { shouldShowBubbleMenu } from '../ui/should-show-bubble-menu';
import { Toolbar } from '../ui/toolbar';
import { InputPopover, type PopoverAnchor } from '../ui/input-popover';
import {
  openInputPopover,
  activeUploads,
  uploadPending,
  uploadPlaceholderKey,
  type InputPopoverBridgeStorage,
  type PopoverKind,
  type UploadPlaceholderStorage,
} from '../extensions';
import { parseContent } from './parse-content';
import { attachFiles, IMAGE_MIME_TYPES, type FileDeps } from './attach-files';
import { applySourceContent, SOURCE_HTML_ERROR_MESSAGE } from './source-mode';
import { buildExtensions } from './use-editor-setup';
import { DEFAULT_FEATURES, type AikiveTextEditorHandle, type AikiveTextEditorProps, type NoticeKind, type Snapshot } from './types';

const htmlOf = (editor: Editor) => (editor.isEmpty ? '' : editor.getHTML());

export const AikiveTextEditor = forwardRef<AikiveTextEditorHandle, AikiveTextEditorProps>(function AikiveTextEditor(
  {
    initialContent,
    editable = true,
    features: featuresProp,
    colors,
    placeholder,
    toolbar = 'fixed',
    htmlClassNames,
    onChange,
    onUploadImage,
    onNotice,
    onSourceModeChange,
    onUploadingChange,
    className,
    contentClassName,
  },
  ref,
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const noticeRef = useRef(onNotice);
  noticeRef.current = onNotice;
  const uploadRef = useRef(onUploadImage);
  uploadRef.current = onUploadImage;
  const [sourceMode, setSourceModeState] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const sourceModeChangeRef = useRef(onSourceModeChange);
  const uploadingChangeRef = useRef(onUploadingChange);
  uploadingChangeRef.current = onUploadingChange;
  const [uploading, setUploading] = useState(false);
  sourceModeChangeRef.current = onSourceModeChange;
  // 핸들은 다시 그려지기 전까지 옛 state 를 보므로, 같은 tick 에 이어 불러도 맞게 모드·소스 글은 ref 로 읽는다
  const sourceModeRef = useRef(false);
  const sourceTextRef = useRef('');
  const sourceEntryRef = useRef('');
  const applySourceMode = (on: boolean) => {
    sourceModeRef.current = on;
    setSourceModeState(on);
  };
  const updateSourceText = (value: string) => {
    sourceTextRef.current = value;
    setSourceText(value);
  };
  const [coarsePointer, setCoarsePointer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const features = { ...DEFAULT_FEATURES, ...featuresProp };
  const [popover, setPopover] = useState<PopoverKind | null>(null);
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const linkEnabledRef = useRef(features.link);
  linkEnabledRef.current = features.link;

  // 서버 렌더링에서는 알 수 없어 마운트 뒤에 읽는다 — 터치 기기는 말풍선 대신 고정 툴바
  useEffect(() => {
    setCoarsePointer(window.matchMedia?.('(pointer: coarse)').matches ?? false);
  }, []);

  const notice = (message: string, kind: NoticeKind) => {
    if (noticeRef.current) noticeRef.current(message, kind);
    else console.warn(message);
  };
  // 확장은 한 번만 만들어지므로 최신 콜백을 ref 로 읽는다
  const fileDeps = (): FileDeps => ({ upload: uploadRef.current, notice });

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: buildExtensions(editable, htmlClassNames, fileDeps, placeholder),
    content: parseContent(initialContent),
    editorProps: {
      attributes: { class: 'tiptap' },
      // 바깥에서 붙여넣은 영상은 새 첨부로 막는다 — 같은 에디터 안 복사·이동은 이 경로를 안 탄다
      transformPastedHTML: (html) => html.replace(/<video[\s\S]*?<\/video>/gi, '').replace(/<video[^>]*\/?>/gi, ''),
    },
    onUpdate: ({ editor: ed }) => onChangeRef.current?.(htmlOf(ed)),
  });

  // useEditor 는 옵션이 바뀌어도 편집 가능 여부를 그대로 둔다
  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
    if (!editable) setPopover(null);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const bridge = (editor.storage as unknown as { inputPopoverBridge: InputPopoverBridgeStorage }).inputPopoverBridge;
    bridge.open = (kind, pos) => {
      if (!editor.isEditable || sourceModeRef.current) return false;
      // 이미지 조작 바는 pos 를 넘긴다 — 단축키·툴바만 link 기능 설정을 따른다
      if (kind === 'link' && pos === undefined && !linkEnabledRef.current) return false;
      if (pos !== undefined) editor.commands.setNodeSelection(pos);
      setPopover(kind);
      return true;
    };
    return () => {
      bridge.open = null;
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const storage = (editor.storage as unknown as { uploadPlaceholder: UploadPlaceholderStorage }).uploadPlaceholder;
    storage.onChange = (on) => {
      setUploading(on);
      uploadingChangeRef.current?.(on);
    };
    return () => {
      storage.onChange = null;
      // 올리는 중에 에디터가 사라지면 끝 알림이 오지 않아 쓰는 쪽 「올리는 중」 이 남는다
      if (storage.pending > 0) uploadingChangeRef.current?.(false);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    (editor.storage as unknown as { inputPopoverBridge: InputPopoverBridgeStorage }).inputPopoverBridge.isOpen = popover !== null;
  }, [editor, popover]);

  const anchorOf = useCallback((): PopoverAnchor => {
    if (!editor) return { left: 0, top: 0, bottom: 0 };
    const { view } = editor;
    const { selection } = editor.state;
    if (selection instanceof NodeSelection) {
      const dom = view.nodeDOM(selection.from);
      if (dom instanceof HTMLElement) {
        const r = dom.getBoundingClientRect();
        return { left: r.left, top: r.top, bottom: r.bottom };
      }
    }
    try {
      // 긴 선택은 시작과 끝을 함께 기준으로 삼으면 위아래 어디에도 안 들어가 끝 줄을 기준으로 한다
      const end = view.coordsAtPos(selection.to);
      return { left: end.left, top: end.top, bottom: end.bottom };
    } catch {
      // 화면에 그려지지 않아 좌표를 못 읽으면(테스트 환경 등) 본문 위쪽에 둔다
      const r = view.dom.getBoundingClientRect();
      return { left: r.left, top: r.top, bottom: r.top };
    }
  }, [editor]);

  // tiptap 은 선택 처음·끝 자리로 재서, 끝이 블록 경계(전체 선택·문서 끝 빈 문단·끌어 옮긴 블록)면 글자와 상관없이 가운데에 뜬다 — 선택 안 첫·끝 글자로 잰다
  const bubbleReference = useCallback(() => {
    if (!editor) return null;
    const { doc, selection } = editor.state;
    if (selection instanceof NodeSelection || selection instanceof CellSelection) return null;
    let from = -1;
    let to = -1;
    doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (!node.isText) return true;
      if (from < 0) from = Math.max(pos, selection.from);
      to = Math.min(pos + node.nodeSize, selection.to);
      return false;
    });
    if (from < 0) return null;
    const rect = posToDOMRect(editor.view, from, to);
    return { getBoundingClientRect: () => rect, getClientRects: () => [rect] };
  }, [editor]);

  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubblePluginKey] = useState(() => new PluginKey('aikiveBubbleMenu'));

  const closePopover = useCallback(
    (refocus: boolean) => {
      setPopover(null);
      if (refocus) editor?.commands.focus();
    },
    [editor],
  );

  const setSourceMode = (on: boolean) => {
    if (!editor || on === sourceModeRef.current) return;
    // 들어가면 본문이 숨어 올리던 이미지를 넣을 자리가 사라진다
    if (on && uploadPending(editor) > 0) return;
    if (on) {
      setPopover(null);
      editor.commands.blur();
      updateSourceText(editor.getHTML());
      sourceEntryRef.current = sourceTextRef.current;
      applySourceMode(true);
      sourceModeChangeRef.current?.(true);
      return;
    }
    // 고치지 않고 닫으면 다시 적용하지 않는다 — 다시 넣으면 정리된 HTML 로 onChange 가 나가 「수정됨」 이 된다
    if (sourceTextRef.current === sourceEntryRef.current) {
      applySourceMode(false);
      sourceModeChangeRef.current?.(false);
      return;
    }
    try {
      applySourceContent(editor, sourceTextRef.current);
    } catch {
      notice(SOURCE_HTML_ERROR_MESSAGE, 'error');
      return;
    }
    applySourceMode(false);
    sourceModeChangeRef.current?.(false);
    onChangeRef.current?.(htmlOf(editor));
  };

  useImperativeHandle(
    ref,
    () => ({
      getHTML: () => (editor ? htmlOf(editor) : ''),
      resetContent: (value) => {
        if (!editor) return;
        // 열린 입력 창은 예전 본문의 위치를 들고 있어 새 본문에 잘못 적용된다
        setPopover(null);
        applySourceMode(false);
        editor.commands.setContent(parseContent(value), { emitUpdate: false });
        // 되돌리기 기록을 새로 시작한다 — 남기면 되돌리기가 이전 내용을 끌어온다
        editor.view.updateState(EditorState.create({ doc: editor.state.doc, plugins: editor.state.plugins }));
        editor.view.dispatch(editor.state.tr);
      },
      takeSnapshot: (): Snapshot | null =>
        editor && !sourceModeRef.current ? { state: editor.state, html: htmlOf(editor) } : null,
      restoreSnapshot: (snapshot) => {
        // 에디터가 다시 만들어졌으면 예전 상태의 플러그인이 맞지 않아 되살리지 않는다
        if (!editor || snapshot.state.schema !== editor.schema) return false;
        setPopover(null);
        applySourceMode(false);
        // 플러그인은 지금 것을 쓴다 — 스냅샷 뒤에 붙은 말풍선 툴바 등이 빠지면 안 된다
        editor.view.updateState(snapshot.state.reconfigure({ plugins: editor.state.plugins }));
        // updateState 는 이벤트를 안 내 툴바 활성 표시가 따라오지 않는다. 스냅샷에 남은 끝난 업로드의 자리 표시도 이때 지운다
        editor.view.dispatch(editor.state.tr.setMeta(uploadPlaceholderKey, { keep: [...activeUploads(editor)] }));
        return true;
      },
      setSourceMode,
      isEmpty: () => !editor || editor.isEmpty,
      isUploading: () => !!editor && uploadPending(editor) > 0,
      insertFiles: async (files) => {
        if (editor) await attachFiles(editor, files, editor.state.selection.anchor, fileDeps());
      },
      focus: () => {
        editor?.commands.focus();
      },
    }),
    [editor, sourceMode, sourceText],
  );

  const useBubble = toolbar === 'bubble' && !coarsePointer && !sourceMode;
  const toolbarNode = editor ? (
    <Toolbar
      editor={editor}
      features={features}
      sourceMode={sourceMode}
      onToggleSource={() => setSourceMode(!sourceMode)}
      onPickImage={onUploadImage ? () => fileInputRef.current?.click() : undefined}
      onOpenPopover={(kind) => openInputPopover(editor, kind)}
      colors={colors}
      uploading={uploading}
      scrollable={coarsePointer}
      boundary={useBubble ? rootEl : null}
    />
  ) : null;
  // tiptap 은 툴바 내용이 바뀌기 전 폭으로 위치를 재서, 표 편집이 빠지는 등 폭이 바뀌면 글자 쪽에서 떨어진다 — 폭이 바뀔 때 다시 잰다
  useEffect(() => {
    const el = bubbleRef.current;
    if (!editor || !useBubble || !el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(bubblePluginKey, 'updatePosition'));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [editor, editable, useBubble, bubblePluginKey]);
  // 말풍선은 화면이 아니라 에디터 좌우 안에서만 밀어, 본문 밖(제목 칸 등)으로 나가지 않게 한다
  const bubbleShift = rootEl ? { boundary: rootEl, padding: 0 } : true;

  return (
    <div ref={setRootEl} className={['aikive-text-editor', className].filter(Boolean).join(' ')}>
      {editable && !useBubble && <div className="aikive-text-editor__toolbar">{toolbarNode}</div>}
      {editable && editor && useBubble && (
        <BubbleMenu ref={bubbleRef} pluginKey={bubblePluginKey} editor={editor} options={{ placement: 'top', offset: 8, shift: bubbleShift }} updateDelay={0} shouldShow={shouldShowBubbleMenu} getReferencedVirtualElement={bubbleReference}>
          {toolbarNode}
        </BubbleMenu>
      )}
      {editable && editor && !coarsePointer && (
        <DragHandle editor={editor} className="aikive-text-editor__drag-handle">
          <GripVertical aria-hidden />
        </DragHandle>
      )}
      {editable && onUploadImage && (
        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple
          accept={IMAGE_MIME_TYPES.join(',')}
          onChange={async (e) => {
            const input = e.target;
            const files = Array.from(input.files ?? []);
            input.value = '';
            if (editor && files.length) await attachFiles(editor, files, editor.state.selection.anchor, fileDeps());
          }}
        />
      )}
      {sourceMode && (
        <textarea
          className="aikive-text-editor__source"
          aria-label="HTML 소스"
          placeholder={placeholder}
          value={sourceText}
          onChange={(e) => {
            updateSourceText(e.target.value);
            onChangeRef.current?.(e.target.value);
          }}
        />
      )}
      {editable && editor && popover && (
        <InputPopover editor={editor} kind={popover} anchor={anchorOf} onClose={closePopover} />
      )}
      <div hidden={sourceMode}>
        <EditorContent editor={editor} className={contentClassName} />
      </div>
    </div>
  );
});
