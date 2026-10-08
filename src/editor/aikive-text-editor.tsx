import { EditorState } from '@tiptap/pm/state';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { parseContent } from './parse-content';
import { attachFiles, type FileDeps } from './attach-files';
import { applySourceContent, SOURCE_HTML_ERROR_MESSAGE } from './source-mode';
import { buildExtensions } from './use-editor-setup';
import type { AikiveTextEditorHandle, AikiveTextEditorProps, NoticeKind, Snapshot } from './types';

const htmlOf = (editor: Editor) => (editor.isEmpty ? '' : editor.getHTML());

export const AikiveTextEditor = forwardRef<AikiveTextEditorHandle, AikiveTextEditorProps>(function AikiveTextEditor(
  { initialContent, editable = true, htmlClassNames, onChange, onUploadImage, onNotice, className, contentClassName },
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
        editor.view.updateState(snapshot.state);
        // updateState 는 이벤트를 안 내 툴바 활성 표시가 따라오지 않는다
        editor.view.dispatch(editor.state.tr);
        return true;
      },
      setSourceMode: (on) => {
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
      },
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

  return (
    <div className={['aikive-text-editor', className].filter(Boolean).join(' ')}>
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
