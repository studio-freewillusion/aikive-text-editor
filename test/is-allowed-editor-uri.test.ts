import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isAllowedEditorUri } from '../src/sanitize';

const ctx = {
    defaultValidate: () => true,
    protocols: ['http', 'https'],
    defaultProtocol: 'https',
};

beforeEach(() => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('isAllowedEditorUri', () => {
    it('http·https 주소는 허용한다', () => {
        expect(isAllowedEditorUri('https://example.com', ctx)).toBe(true);
        expect(isAllowedEditorUri('http://example.com', ctx)).toBe(true);
    });

    it('mailto·ftp·file 주소는 막는다', () => {
        expect(isAllowedEditorUri('mailto:a@b.com', ctx)).toBe(false);
        expect(isAllowedEditorUri('ftp://example.com', ctx)).toBe(false);
        expect(isAllowedEditorUri('file:///etc/passwd', ctx)).toBe(false);
    });

    it('막을 때도 경고창을 띄우지 않는다', () => {
        isAllowedEditorUri('mailto:a@b.com', ctx);

        expect(window.alert).not.toHaveBeenCalled();
    });

    it('기본 검증이 거부하면 막는다', () => {
        expect(
            isAllowedEditorUri('https://example.com', { ...ctx, defaultValidate: () => false }),
        ).toBe(false);
    });
});
