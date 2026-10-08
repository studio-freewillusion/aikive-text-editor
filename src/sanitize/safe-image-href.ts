// 이미지는 block 노드라 link mark 가 안 붙는다 — 링크는 노드 속성으로 들고 출력할 때만 <a> 로 감싼다
export const safeImageHref = (value: unknown) => {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();

    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
};

// 스킴을 안 적은 주소는 https 로 채운다. 그래도 http/https 가 아니면 링크로 받지 않는다.
export const normalizeImageHref = (value: unknown) => {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();

    if (!trimmed) {
        return null;
    }

    return safeImageHref(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
};

