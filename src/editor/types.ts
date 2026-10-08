import type { EditorState } from '@tiptap/pm/state';

// 툴바 기능 켜기/끄기 — 기본값 모두 true, 끈 기능은 버튼만 숨기고 기존 내용은 보존
export interface Features {
  heading?: boolean;
  fontSize?: boolean;
  color?: boolean;
  lineHeight?: boolean;
  align?: boolean;
  table?: boolean;
  image?: boolean;
  link?: boolean;
  sourceMode?: boolean;
  undoRedo?: boolean;
}

export const DEFAULT_FEATURES: Required<Features> = {
  heading: true,
  fontSize: true,
  color: true,
  lineHeight: true,
  align: true,
  table: true,
  image: true,
  link: true,
  sourceMode: true,
  undoRedo: true,
};

// 기존 저장 HTML 의 class 를 그대로 내기 위해 쓰는 쪽이 넘긴다
export interface HtmlClassNames {
  youtube?: string;
}

export type NoticeKind = 'info' | 'error';

export interface AikiveTextEditorProps {
  initialContent?: string;
  editable?: boolean;
  features?: Features;
  toolbar?: 'fixed' | 'bubble';
  htmlClassNames?: HtmlClassNames;
  onChange?: (html: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  onNotice?: (message: string, kind: NoticeKind) => void;
  className?: string;
  contentClassName?: string;
}

export interface Snapshot {
  state: EditorState;
  html: string;
}

export interface AikiveTextEditorHandle {
  getHTML(): string;
  resetContent(value: string): void;
  takeSnapshot(): Snapshot | null;
  restoreSnapshot(snapshot: Snapshot): boolean;
  setSourceMode(on: boolean): void;
  isEmpty(): boolean;
  insertFiles(files: File[]): Promise<void>;
  focus(): void;
}
