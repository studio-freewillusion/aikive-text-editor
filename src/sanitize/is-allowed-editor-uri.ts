type UriContext = {
    defaultValidate: (url: string) => boolean;
    protocols: Array<string | { scheme: string }>;
    defaultProtocol: string;
};

// 저장된 본문을 파싱할 때도 불리므로 여기서 alert 를 띄우면 안 된다 —
// mailto·상대 링크가 든 글을 열면 링크 수만큼 경고가 뜬다. 링크는 조용히 버린다.
export const isAllowedEditorUri = (url: string, ctx: UriContext) => {
    try {
        if (!url.startsWith('http') && !url.startsWith('https')) {
            return false;
        }

        const parsedUrl = url.includes(':')
            ? new URL(url)
            : new URL(`${ctx.defaultProtocol}://${url}`);

        if (!ctx.defaultValidate(parsedUrl.href)) {
            return false;
        }

        const protocol = parsedUrl.protocol.replace(':', '');

        if (['ftp', 'file', 'mailto'].includes(protocol)) {
            return false;
        }

        const allowedProtocols = ctx.protocols.map((p) => (typeof p === 'string' ? p : p.scheme));

        return allowedProtocols.includes(protocol);
    } catch {
        return false;
    }
};

