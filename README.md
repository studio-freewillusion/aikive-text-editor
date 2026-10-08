# aikive-text-editor

tiptap 기반 리치 텍스트 에디터와 본문 뷰어 (React)

## 설치

npm 에 올리기 전까지는 GitHub Release 의 `.tgz` 주소로 설치합니다.

```bash
npm install https://github.com/studio-freewillusion/aikive-text-editor/releases/download/v0.1.2/studio-freewillusion-aikive-text-editor-0.1.2.tgz
```

React 19 가 필요합니다(`peerDependencies`).

설치한 뒤 `prosemirror-model` 이 한 벌만 깔렸는지 확인합니다. 두 벌이면 에디터를 열 때 플러그인 충돌로 멈춥니다(lockfile 에 옛 버전이 남아 있을 때 생깁니다).

```bash
npm ls prosemirror-model                          # npm — 버전이 하나여야 한다
pnpm why prosemirror-model                        # pnpm
pnpm update --depth Infinity "prosemirror-*"      # 두 벌이면(pnpm)
npm dedupe                                        # 두 벌이면(npm)
```

## 진입점

| 경로 | 내용 |
| --- | --- |
| `@studio-freewillusion/aikive-text-editor/viewer` | `AikiveTextViewer`, `toPlainText`, `sanitizeRichHtml` — tiptap 을 불러오지 않아 서버 렌더링에 씁니다 |
| `@studio-freewillusion/aikive-text-editor/editor` | `AikiveTextEditor` — 브라우저 전용(`'use client'`) |
| `@studio-freewillusion/aikive-text-editor/styles.css` | 본문·툴바 스타일 |
| `@studio-freewillusion/aikive-text-editor/content-guide.md` | AI 에게 본문 작성을 맡길 때 넘기는 HTML 형식 안내([docs/content-guide.md](docs/content-guide.md)) |

## 본문 보기

```tsx
import { AikiveTextViewer } from '@studio-freewillusion/aikive-text-editor/viewer';
import '@studio-freewillusion/aikive-text-editor/styles.css';

<AikiveTextViewer
  content={html}
  resolveImageSrc={(src) => resizedUrl(src)}
  onClickImage={(src) => openZoom(src)}
/>;
```

| prop | 설명 |
| --- | --- |
| `content` | HTML 또는 옛 tiptap JSON 문서 |
| `resolveImageSrc` | 이미지 표시 주소를 바꾸는 함수(리사이즈 등). 없으면 원본 주소 |
| `onClickImage` | 링크가 없는 이미지를 눌렀을 때 원본 주소로 불림 |
| `lazyMedia` | 이미지·iframe·영상을 화면에 보일 때만 받음 |
| `extraIframeHosts` | 유튜브·vimeo 밖에 더 허용할 iframe 호스트 |
| `className` | 루트에 붙일 클래스(루트에는 항상 `tiptap` 이 붙음) |

HTML 은 화면에 넣기 전에 항상 정화합니다(허용 태그·속성, 허용 호스트 iframe 만, 새 탭 링크에 `rel="noopener noreferrer"`).

## 에디터

```tsx
'use client';
import { AikiveTextEditor, type AikiveTextEditorHandle } from '@studio-freewillusion/aikive-text-editor/editor';

const ref = useRef<AikiveTextEditorHandle>(null);

<AikiveTextEditor
  ref={ref}
  initialContent={html}
  features={{ sourceMode: false }}
  toolbar="bubble"
  onChange={setHtml}
  onUploadImage={async (file) => uploadAndGetUrl(file)}
  onNotice={(message, kind) => toast(message)}
/>;
```

| prop | 설명 |
| --- | --- |
| `initialContent` | HTML 또는 옛 tiptap JSON 문서 |
| `editable` | 기본 `true` |
| `features` | 툴바 기능 켜기/끄기(아래) |
| `toolbar` | `'fixed'`(기본) 또는 `'bubble'`(글자를 고르면 뜸). 터치 기기는 항상 고정 툴바 |
| `htmlClassNames` | `{ youtube }` — 저장 HTML 의 유튜브 iframe 에 붙일 class |
| `onChange(html)` | 내용이 바뀔 때. 빈 에디터면 `''` |
| `onUploadImage(file)` | 이미지를 올리고 주소를 돌려줌. 없으면 이미지 넣기를 숨김 |
| `onNotice(message, kind)` | 안내 문구(`'info'`·`'error'`). 없으면 콘솔 경고 |
| `onSourceModeChange(on)` | HTML 모드가 실제로 바뀔 때. HTML 적용에 실패하면 부르지 않음. `resetContent`·`restoreSnapshot` 이 끌 때도 부르지 않음. 바깥 토글은 `setSourceMode` 를 부르고, 토글 상태는 이 콜백으로만 바꿀 것 |

**features** — 기본값은 모두 `true`. 끈 기능은 버튼만 숨기고, 이미 들어 있는 내용은 보존합니다.

| 키 | 버튼 |
| --- | --- |
| `heading` | 제목 1~3 |
| `fontSize` | 글자 크기 |
| `color` | 글자색 |
| `lineHeight` | 줄간격 |
| `align` | 정렬 |
| `table` | 표 넣기·편집 |
| `image` | 이미지 넣기(`onUploadImage` 가 있을 때) |
| `link` | 링크 |
| `sourceMode` | HTML 모드 |
| `undoRedo` | 되돌리기·다시 하기 |

굵게·기울임·밑줄·취소선은 항상 켜져 있습니다. 새 영상 파일은 넣을 수 없습니다(기존 영상 블록은 그대로 보이고 편집됩니다).

**ref 명령**

| 명령 | 설명 |
| --- | --- |
| `getHTML()` | 지금 HTML(빈 에디터면 `''`) |
| `resetContent(value)` | 내용을 바꾸고 되돌리기 기록을 새로 시작. `onChange` 를 부르지 않음 |
| `takeSnapshot()` / `restoreSnapshot(s)` | 편집 상태(되돌리기 기록 포함) 저장·되살리기 — 탭마다 다른 내용을 한 에디터로 편집할 때 |
| `setSourceMode(on)` | HTML 모드 켜고 끄기 |
| `isEmpty()` | 비었는지 |
| `insertFiles(files)` | 파일 넣기(이미지만, 10MB 이하) |
| `focus()` | 포커스 |

## 색 바꾸기

`styles.css` 의 CSS 변수를 덮어씁니다.

| 변수 | 기본값 |
| --- | --- |
| `--aikive-text-bg` | `#18181a` |
| `--aikive-text-fg` | `#e4e6e7` |
| `--aikive-text-link` | `#46add4` |
| `--aikive-text-scrollbar` | `rgba(255, 255, 255, 0.42)` |
| `--aikive-toolbar-bg` | `#28282b` |
| `--aikive-toolbar-fg` | `#ebebeb` |
| `--aikive-toolbar-border` | `#525259` |
| `--aikive-toolbar-hover` | `#3b3b40` |
| `--aikive-toolbar-active` | `#46add4` |

## 개발

```bash
npm install
npm test          # 단위 테스트
npm run test:e2e  # 브라우저 테스트(Chrome·WebKit)
npm run demo      # 데모 페이지
npm run build
```

## License

MIT
