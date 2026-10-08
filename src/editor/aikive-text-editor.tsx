import { EditorState } from '@tiptap/pm/state';
import DragHandle from '@tiptap/extension-drag-handle-react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { GripVertical } from '../ui/icons';
import { shouldShowBubbleMenu } from '../ui/should-show-bubble-menu';
import { Toolbar } from '../ui/toolbar';
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
    toolbar = 'fixed',
    htmlClassNames,
    onChange,
    onUploadImage,
    onNotice,
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
  const [coarsePointer, setCoarsePointer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const features = { ...DEFAULT_FEATURES, ...featuresProp };

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
    extensions: buildExtensions(editable, htmlClassNames, fileDeps),
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
  }, [editor, editable]);

  const setSourceMode = (on: boolean) => {
    if (!editor || on === sourceMode) return;
    if (on) {
      editor.commands.blur();
      setSourceText(editor.getHTML());
      setSourceModeState(true);
      return;
    }
    try {
      applySourceContent(editor, sourceText);
    } catch {
      notice(SOURCE_HTML_ERROR_MESSAGE, 'error');
      return;
    }
    setSourceModeState(false);
    onChangeRef.current?.(htmlOf(editor));
  };

  useImperativeHandle(
    ref,
    () => ({
      getHTML: () => (editor ? htmlOf(editor) : ''),
      resetContent: (value) => {
        if (!editor) return;
        setSourceModeState(false);
        editor.commands.setContent(parseContent(value), { emitUpdate: false });
        // 되돌리기 기록을 새로 시작한다 — 남기면 되돌리기가 이전 내용을 끌어온다
        editor.view.updateState(EditorState.create({ doc: editor.state.doc, plugins: editor.state.plugins }));
        editor.view.dispatch(editor.state.tr);
      },
      takeSnapshot: (): Snapshot | null =>
        editor && !sourceMode ? { state: editor.state, html: editor.getHTML() } : null,
      restoreSnapshot: (snapshot) => {
        // 에디터가 다시 만들어졌으면 예전 상태의 플러그인이 맞지 않아 되살리지 않는다
        if (!editor || snapshot.state.schema !== editor.schema) return false;
        setSourceModeState(false);
        // 플러그인은 지금 것을 쓴다 — 스냅샷 뒤에 붙은 말풍선 툴바 등이 빠지면 안 된다
        editor.view.updateState(snapshot.state.reconfigure({ plugins: editor.state.plugins }));
        // updateState 는 이벤트를 안 내 툴바 활성 표시가 따라오지 않는다
        editor.view.dispatch(editor.state.tr);
        return true;
      },
      setSourceMode,
      isEmpty: () => !editor || editor.isEmpty,
      insertFiles: async (files) => {
        if (editor) await attachFiles(editor, files, editor.state.selection.anchor, fileDeps());
      },
      focus: () => {
        editor?.commands.focus();
      },
    }),
    [editor, sourceMode, sourceText],
  );

  const toolbarNode = editor ? (
    <Toolbar
      editor={editor}
      features={features}
      sourceMode={sourceMode}
      onToggleSource={() => setSourceMode(!sourceMode)}
      onPickImage={onUploadImage ? () => fileInputRef.current?.click() : undefined}
      onNotice={notice}
      scrollable={coarsePointer}
    />
  ) : null;
  const useBubble = toolbar === 'bubble' && !coarsePointer && !sourceMode;

  return (
    <div className={['aikive-text-editor', className].filter(Boolean).join(' ')}>
      {editable && !useBubble && <div className="aikive-text-editor__toolbar">{toolbarNode}</div>}
      {editable && editor && useBubble && (
        <BubbleMenu editor={editor} options={{ placement: 'top', offset: 8 }} updateDelay={0} shouldShow={shouldShowBubbleMenu}>
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
          value={sourceText}
          onChange={(e) => {
            setSourceText(e.target.value);
            onChangeRef.current?.(e.target.value);
          }}
        />
      )}
      <div hidden={sourceMode}>
        <EditorContent editor={editor} className={contentClassName} />
      </div>
    </div>
  );
});
