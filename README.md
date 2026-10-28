# aikive-text-editor

tiptap 기반 리치 텍스트 에디터와 본문 뷰어 (React)

## 설치

npm 에 올리기 전까지는 GitHub Release 의 `.tgz` 주소로 설치합니다.

```bash
npm install https://github.com/studio-freewillusion/aikive-text-editor/releases/download/v0.1.3/studio-freewillusion-aikive-text-editor-0.1.3.tgz
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

`sanitizeRichHtml` 결과를 직접 넣을 때는 감싸는 요소에 `contain: paint` 를 함께 둡니다. 정화는 입력 폼·위치 지정 같은 큰 구멍만 막고, 본문 CSS 가 영역 밖으로 넘쳐 칠하는 것은 `AikiveTextViewer` 루트가 잘라서 막습니다.
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
| `embedHosts` | 영상 블록으로 받는 호스트. 이 호스트의 iframe 은 `/embed/watch/<ID>` 경로(쿼리·해시 없음)만 남기고 나머지는 지움 |
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
| `colors` | 글자색 팔레트의 미리 정한 색 `{ label, value }[]`. 없으면 기본 9색. 「기본」·「직접 고르기」 는 항상 있음 |
| `toolbar` | `'fixed'`(기본) 또는 `'bubble'`(글자를 고르면 뜸). 터치 기기는 항상 고정 툴바(밀어서 넘김). 칸이 좁으면 툴바는 한 줄을 유지하고 들어가지 않는 항목을 오른쪽 끝부터 「⋯」(더 보기)로 옮긴다 |
| `htmlClassNames` | `{ youtube }` — 저장 HTML 의 유튜브 iframe 에 붙일 class |
| `embedHosts` | 붙여넣은 영상 주소를 영상 블록으로 넣을 수 있는 호스트(아래 「영상 주소 붙여넣기」). 처음 그릴 때의 값만 씀. 비우면 영상 블록을 쓰지 않음. 목록에 없는 호스트의 영상 블록은 열 때 빠지므로, 기존 글을 고쳐 저장하면 사라짐 |
| `onChange(html)` | 내용이 바뀔 때. 빈 에디터면 `''` |
| `onUploadImage(file)` | 이미지를 올리고 주소를 돌려줌. 없으면 이미지 넣기를 숨김 |
| `onNotice(message, kind)` | 안내 문구(`'info'`·`'error'`). 없으면 콘솔 경고 |
| `onSourceModeChange(on)` | HTML 모드가 실제로 바뀔 때. HTML 적용에 실패하면 부르지 않음. `resetContent`·`restoreSnapshot` 이 끌 때도 부르지 않음. 바깥 토글은 `setSourceMode` 를 부르고, 토글 상태는 이 콜백으로만 바꿀 것 |
| `placeholder` | 빈 본문 안내 문구. 저장 HTML 에는 들어가지 않음. 처음 그릴 때의 값만 씀(바꾸려면 에디터를 다시 만듦) |
| `onUploadingChange(uploading)` | 이미지를 올리는 중 상태가 바뀔 때만. 올리는 중에는 HTML 모드로 들어가지 않음 |

**features** — 기본값은 모두 `true`. 끈 기능은 버튼만 숨기고, 이미 들어 있는 내용은 보존합니다.

| 키 | 버튼 |
| --- | --- |
| `heading` | 「문단 종류」의 제목 1~3 |
| `fontSize` | 글자 크기 |
| `color` | 글자색 |
| `lineHeight` | 줄간격 |
| `align` | 「정렬」 선택 |
| `table` | 「넣기」의 표, 표 안에서 「표 편집」 |
| `image` | 「넣기」의 이미지(`onUploadImage` 가 있을 때) |
| `link` | 링크(Ctrl/⌘+K) |
| `list` | 「문단 종류」의 글머리·번호 목록 |
| `blocks` | 「문단 종류」의 인용·코드 블록, 「넣기」의 구분선 |
| `youtube` | 붙여넣은 유튜브 주소를 플레이어로 넣는 선택 |
| `sourceMode` | HTML 모드 |
| `undoRedo` | 되돌리기·다시 하기 |

굵게·기울임·밑줄·취소선은 항상 켜져 있습니다. 새 영상 파일은 넣을 수 없습니다(기존 영상 블록은 그대로 보이고 편집됩니다).

**영상 주소 붙여넣기** — 주소 하나만 붙여넣으면 링크로 들어가고 그 아래에 「플레이어로 넣기 / 링크로 두기」 창이 뜹니다. 기본은 「링크로 두기」 입니다. ↑↓ 로 고르고 Enter 로 실행하며, Esc·이어 쓰기·바깥 클릭은 「링크로 두기」 와 같습니다.

- 유튜브 주소: `features.youtube` 가 켜져 있을 때
- `embedHosts` 의 주소: `https://<호스트>/watch?v=<ID>` 또는 `https://<호스트>/embed/watch/<ID>`. 저장 HTML 은 `<div data-aikive-video=""><iframe src="https://<호스트>/embed/watch/<ID>" …></iframe></div>` 입니다. 에디터 안 iframe 은 주소 끝에 `?preview=1` 을 붙여 그리며 저장 HTML 에는 넣지 않습니다.

**ref 명령**

| 명령 | 설명 |
| --- | --- |
| `getHTML()` | 지금 HTML(빈 에디터면 `''`) |
| `resetContent(value)` | 내용을 바꾸고 되돌리기 기록을 새로 시작. `onChange` 를 부르지 않음 |
| `takeSnapshot()` / `restoreSnapshot(s)` | 편집 상태(되돌리기 기록 포함) 저장·되살리기 — 탭마다 다른 내용을 한 에디터로 편집할 때 |
| `setSourceMode(on)` | HTML 모드 켜고 끄기 |
| `isEmpty()` | 비었는지 |
| `isUploading()` | 이미지를 올리는 중인지 — 저장 전에 확인 |
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
| `--aikive-text-error` | `#f96960` |
| `--aikive-quote-bg` | `#28282b` |
| `--aikive-quote-border` | `#525259` |
| `--aikive-text-font` | 없음 — 지정하지 않으면 페이지 글꼴을 따릅니다. 본문·툴바·입력 창에 다른 글꼴을 쓰려면 지정합니다 |
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
