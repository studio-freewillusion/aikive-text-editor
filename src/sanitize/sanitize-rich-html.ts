import DOMPurify from 'isomorphic-dompurify';
import { isAikiveEmbedSrc } from './aikive-video-url';
import { sanitizeBodyStyle } from './sanitize-link-style';

// 본문 HTML 정화 — 허용 iframe 호스트·새 탭 링크 보호는 훅으로 항상 강제하고 허용 폭만 옵션으로 받는다
// iframe(영상 임베드)으로 허용할 도메인 목록. 이 목록 밖의 iframe은 통째로 제거한다.
const ALLOWED_IFRAME_HOSTS = new Set<string>([
    'www.youtube.com',
    'youtube.com',
    'www.youtube-nocookie.com',
    'youtube-nocookie.com',
    'player.vimeo.com',
]);

// 본문에 입력 폼·페이지 CSS 를 넣으면 사이트 안에 가짜 로그인 화면을 만들 수 있다
const FORBIDDEN_TAGS = ['form', 'input', 'button', 'textarea', 'select', 'option', 'style'];

// 호출할 때마다 항상 허용하는 속성(iframe 임베드에 필요한 것들 + 링크 target).
const BASE_ALLOWED_ATTRS = [
    'src',
    'allow',
    'allowfullscreen',
    'frameborder',
    'scrolling',
    'target',
];

// 훅을 한 번만 등록하기 위한 표시. globalThis가 아니라 모듈 변수로 둬야
// 서버 번들과 브라우저 번들에서 각각 한 번씩 정상 등록된다.
let isHookRegistered = false;

// 훅은 라이브러리 공용 인스턴스에 걸리므로, 쓰는 쪽이 같은 라이브러리를 직접 부를 때는 아무것도 하지 않는다
let isPackageCall = false;

// 이번 정화 호출에서 이미지·iframe 은 loading="lazy", 영상은 preload="none" 을 붙일지. sanitize 는 동기라 호출 동안만 켜 둔다.
let isLazyMediaCall = false;

// 호출마다 다른 추가 허용 호스트 — 훅은 한 번만 등록되므로 호출 동안만 담아 둔다
let extraIframeHostsCall: ReadonlySet<string> = new Set();

// 영상 블록으로 받는 호스트 — 이 호스트의 iframe 은 정확한 embed 경로일 때만 남긴다
let embedHostsCall: readonly string[] = [];

/**
 * src 문자열에서 도메인(host)만 뽑아낸다. 빈 값/상대경로/이상한 값이면 빈 문자열을 돌려줘
 * 허용 목록과 절대 일치하지 않게 한다(=제거 대상).
 */
const getHost = (src: string): string => {
    try {
        // 두 번째 인자는 상대경로를 처리하기 위한 기준 주소. 상대경로면 host가 이 기준값이 되어
        // 허용 목록에 없으므로 제거된다.
        return new URL(src, 'https://invalid.local').hostname;
    } catch {
        return '';
    }
};

/**
 * 모든 DOMPurify 정화에 공통으로 적용되는 보안 규칙을 등록한다.
 * - iframe: src 도메인이 허용 목록 밖이면 그 iframe을 제거한다.
 * - target="_blank" 링크: 새 탭이 원래 탭을 조작하지 못하도록 rel="noopener noreferrer"를 강제한다.
 */
const ensureSecurityHook = () => {
    if (isHookRegistered) return;
    isHookRegistered = true;

    DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
        if (!isPackageCall || data.attrName !== 'style') return;
        const style = sanitizeBodyStyle(data.attrValue);
        if (style) {
            data.attrValue = style;
        } else {
            data.keepAttr = false;
        }
    });

    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (!isPackageCall) return;
        const el = node as Element;
        if (typeof el.getAttribute !== 'function') return;

        if (el.tagName === 'IFRAME') {
            const src = el.getAttribute('src') ?? '';
            const host = getHost(src);
            const isEmbedHost = embedHostsCall.some((h) => h.toLowerCase() === host);
            const keep = isEmbedHost
                ? isAikiveEmbedSrc(src, embedHostsCall)
                : ALLOWED_IFRAME_HOSTS.has(host) || extraIframeHostsCall.has(host);
            if (!keep) {
                el.remove();
                return;
            }
            // 임베드 화면이 퍼간 곳의 도메인을 읽을 수 있게 출처는 보낸다
            el.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        }

        if (el.getAttribute('target') === '_blank') {
            el.setAttribute('rel', 'noopener noreferrer');
        }

        if (isLazyMediaCall && (el.tagName === 'IMG' || el.tagName === 'IFRAME')) {
            el.setAttribute('loading', 'lazy');
        }
        if (isLazyMediaCall && el.tagName === 'VIDEO') {
            el.setAttribute('preload', 'none');
        }
    });
};

interface SanitizeOptions {
    /** iframe(영상 임베드) 허용 여부. 기본 true. 허용해도 도메인은 위 목록으로 제한된다. */
    allowIframe?: boolean;
    /** 호출하는 쪽에서 추가로 허용하고 싶은 속성 이름들. */
    extraAttrs?: string[];
    /** 이미지·iframe·영상을 화면에 보일 때만 받게 한다(숨겨진 본문용). 기본 false. */
    lazyMedia?: boolean;
    /** 기본 허용 목록 밖에서 이번 호출만 더 허용할 iframe 호스트. */
    extraIframeHosts?: string[];
    /** 영상 블록으로 받는 호스트. 이 호스트의 iframe 은 `/embed/watch/<ID>` 경로만 남긴다. */
    embedHosts?: string[];
}

/**
 * 본문 HTML을 걸러서 안전한 HTML 문자열로 돌려준다.
 * 위험한 태그/속성(script, onerror 등)은 제거되고, iframe은 허용 도메인만 남는다.
 */
export const sanitizeRichHtml = (html: string, options: SanitizeOptions = {}): string => {
    ensureSecurityHook();
    const { allowIframe = true, extraAttrs = [], lazyMedia = false, extraIframeHosts = [], embedHosts = [] } = options;

    isPackageCall = true;
    isLazyMediaCall = lazyMedia;
    extraIframeHostsCall = new Set(extraIframeHosts);
    embedHostsCall = embedHosts;
    try {
        return DOMPurify.sanitize(html, {
            ...(allowIframe ? { ADD_TAGS: ['iframe'] } : {}),
            ADD_ATTR: [...BASE_ALLOWED_ATTRS, ...extraAttrs],
            FORBID_TAGS: FORBIDDEN_TAGS,
        });
    } finally {
        isPackageCall = false;
        isLazyMediaCall = false;
        extraIframeHostsCall = new Set();
        embedHostsCall = [];
    }
};
