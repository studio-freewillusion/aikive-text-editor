# 본문 HTML 작성 가이드 (AI 용)

aikive-text-editor 로 저장하는 본문을 AI 가 직접 쓸 때 따르는 형식입니다. 에디터의 HTML 모드에 붙여 넣거나 저장 값으로 바로 쓸 수 있습니다.

- 아래 예시는 저장해도 한 글자도 바뀌지 않는 형태입니다. 가능하면 그대로 따라 씁니다.
- 예시와 다르게 써도 저장할 때 같은 형태로 바뀝니다. 다만 아래 「쓰지 않는 것」은 저장할 때 빠지거나 의도와 다르게 보입니다.
- 본문은 블록(문단·제목·목록·표·이미지 등)을 차례로 늘어놓은 것입니다. 블록을 다른 태그로 감싸지 않습니다.

## 문단과 줄바꿈

모든 글자는 블록 안에 둡니다. 문단은 `<p>`, 문단 안 줄바꿈은 `<br>` 입니다. 빈 줄이 필요하면 빈 문단을 넣습니다.

```html
<p>첫 문단입니다.</p><p>둘째 문단의 첫 줄<br>둘째 줄</p><p></p><p>빈 줄 다음 문단</p>
```

## 제목

`<h1>`·`<h2>`·`<h3>` 를 씁니다.

```html
<h1>큰 제목</h1><h2>중간 제목</h2><h3>작은 제목</h3>
```

## 글자 서식

굵게 `<strong>`, 기울임 `<em>`, 밑줄 `<u>`, 취소선 `<s>`, 짧은 코드 `<code>` 입니다. 서로 겹쳐 쓸 수 있습니다.

```html
<p><strong>굵게</strong>, <em>기울임</em>, <u>밑줄</u>, <s>취소선</s>, <code>코드</code>, <strong><em>굵은 기울임</em></strong></p>
```

## 정렬

문단과 제목에 `style="text-align: …;"` 를 붙입니다. 값은 `left`·`center`·`right`·`justify` 입니다.

```html
<h2 style="text-align: center;">가운데 제목</h2><p style="text-align: right;">오른쪽 문단</p>
```

## 글자색·글자 크기·줄간격

`<span style="…">` 로 감쌉니다. 한 `<span>` 에는 하나만 씁니다. 값은 아래 목록에서 고릅니다.

```html
<p><span style="color: rgb(220, 38, 38);">빨간 글자</span> <span style="font-size: 24px;">큰 글자</span></p><p><span style="line-height: 2;">줄간격을 넓힌 문단</span></p>
```

## 글자 크기

`10px`, `11px`, `12px`, `14px`, `16px`, `18px`, `21px`, `24px`, `36px`, `48px`, `60px`, `72px`

## 글자색

| 이름 | 값 |
| --- | --- |
| 검정 | `rgb(17, 17, 17)` |
| 회색 | `rgb(107, 114, 128)` |
| 빨강 | `rgb(220, 38, 38)` |
| 주황 | `rgb(234, 88, 12)` |
| 노랑 | `rgb(202, 138, 4)` |
| 초록 | `rgb(22, 163, 74)` |
| 파랑 | `rgb(37, 99, 235)` |
| 남색 | `rgb(67, 56, 202)` |
| 보라 | `rgb(124, 58, 237)` |

다른 색도 쓸 수 있습니다. `#rrggbb` 로 써도 저장하면 `rgb(…)` 로 바뀝니다.

## 줄간격

`1`, `1.5`, `2`

## 목록

목록 항목 안의 글자도 `<p>` 로 감쌉니다. 목록 안에 목록을 넣을 수 있습니다.

```html
<ul><li><p>첫 항목</p></li><li><p>둘째 항목</p><ul><li><p>안쪽 항목</p></li></ul></li></ul><ol><li><p>1번</p></li><li><p>2번</p></li></ol>
```

## 인용·구분선·코드 블록

```html
<blockquote><p>인용한 글</p></blockquote><hr><pre><code>여러 줄 코드
둘째 줄</code></pre>
```

## 링크

`http://`·`https://` 주소만 링크가 됩니다. 링크는 새 탭에서 열립니다.

```html
<p>자세한 내용은 <a target="_blank" rel="noopener noreferrer" href="https://example.com/notice">공지</a>를 보세요.</p>
```

## 표

첫 줄을 머리글로 쓰려면 `<th>` 를 씁니다. 칸 안의 글자도 `<p>` 로 감쌉니다. `<colgroup>` 과 `<table>` 의 `style` 은 칸 수에 맞춰 위처럼 씁니다(칸 하나에 `25px`).

```html
<table style="min-width: 50px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><th><p>항목</p></th><th><p>내용</p></th></tr><tr><td><p>기간</p></td><td><p>10월 1일 ~ 10월 31일</p></td></tr></tbody></table>
```

열 너비를 정하려면 그 열의 칸마다 `colwidth`(px)를 쓰고, `<col>` 과 `<table>` 의 너비도 맞춥니다.

```html
<table style="min-width: 225px;"><colgroup><col style="width: 200px;"><col style="min-width: 25px;"></colgroup><tbody><tr><td colwidth="200"><p>넓은 열</p></td><td><p>나머지</p></td></tr></tbody></table>
```

## 이미지

이미지는 블록 하나로 씁니다(`<p>` 안에 넣지 않습니다). 주소는 `https://` 로 시작해야 합니다. 너비는 `%` 로 정합니다.

```html
<img src="https://cdn.example.com/a.png" alt="이미지 설명" style="display: block; width: 100%;"><img src="https://cdn.example.com/b.png" style="display: block; width: 50%;">
```

이미지에 링크를 걸려면 `<a>` 로 감쌉니다. 링크가 걸린 이미지는 눌러도 확대되지 않고 링크로 이동합니다.

```html
<a href="https://example.com" target="_blank" rel="noopener noreferrer"><img src="https://cdn.example.com/a.png" style="display: block; width: 100%;"></a>
```

## 유튜브

아래처럼 줄여 써도 됩니다. 나머지 속성은 저장할 때 붙습니다. 주소는 `https://www.youtube.com/embed/영상ID` 나 `https://www.youtube-nocookie.com/embed/영상ID` 형태입니다.

```html 줄여 쓰기
<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID"></iframe></div>
```

## 이모지

이모지는 글자 그대로 씁니다. 😀🎉

```html
<p>축하합니다 🎉</p>
```

## 쓰지 않는 것

- `class`·`id`·`on…` 속성, `<script>`·`<style>` — 저장할 때 빠집니다.
- 블록을 감싸는 `<div>`·`<section>` — 감싸개는 빠지고 안의 블록만 남습니다.
- `data:` 로 시작하는 이미지 주소 — 저장할 때 빠집니다.
- 유튜브가 아닌 `<iframe>` — 저장할 때 빠집니다.
- 영상 파일(`<video>`) — 새로 넣지 않습니다. 영상은 유튜브로 넣습니다.
- 위에 없는 `style` 값(배경색·여백 등) — 저장할 때 빠지거나 보이지 않습니다.

## 전체 예시

```html
<h2 style="text-align: center;">10월 이벤트 안내</h2>
<p>안녕하세요. <strong>10월 이벤트</strong> 일정을 안내드립니다.</p>
<table style="min-width: 50px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><th><p>항목</p></th><th><p>내용</p></th></tr><tr><td><p>기간</p></td><td><p>10월 1일 ~ 10월 31일</p></td></tr></tbody></table>
<p></p>
<img src="https://cdn.example.com/event.png" alt="이벤트 포스터" style="display: block; width: 100%;">
<ul><li><p>참여 방법: 영상을 올린 뒤 <a target="_blank" rel="noopener noreferrer" href="https://example.com/event">이벤트 페이지</a>에서 신청</p></li><li><p><span style="color: rgb(220, 38, 38);">마감일 이후 신청은 받지 않습니다.</span></p></li></ul>
```
