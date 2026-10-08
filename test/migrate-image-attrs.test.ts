import { describe, expect, it } from 'vitest';

import { migrateImageAttrs } from '../src/extensions';

const imageDoc = (attrs: Record<string, unknown>) => ({
    type: 'doc',
    content: [{ type: 'image', attrs: { src: 'https://cdn.example.com/a.png', ...attrs } }],
});

const firstImageAttrs = (doc: Record<string, unknown>) =>
    (doc as { content: { attrs: Record<string, unknown> }[] }).content[0].attrs;

describe('migrateImageAttrs', () => {
    it('저장된 이미지 링크를 그대로 둔다', () => {
        const attrs = firstImageAttrs(
            migrateImageAttrs(imageDoc({ href: 'https://example.com', target: '_blank' })),
        );

        expect(attrs.href).toBe('https://example.com');
        expect(attrs.target).toBe('_blank');
    });

    it('링크가 없는 이미지는 null 로 채운다', () => {
        const attrs = firstImageAttrs(migrateImageAttrs(imageDoc({})));

        expect(attrs.href).toBeNull();
        expect(attrs.target).toBeNull();
    });
});
