import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it } from 'vitest';

import { CustomImage } from '../src/extensions';

const SRC = 'https://cdn.example.com/public/posts/a.png';

let editor: Editor;

function createEditor(content: string) {
    editor = new Editor({
        element: document.createElement('div'),
        extensions: [StarterKit, CustomImage],
        content,
    });
    return editor;
}

afterEach(() => {
    editor?.destroy();
});

describe('CustomImage 링크', () => {
    it('href 가 있는 이미지는 a 태그로 감싸 렌더한다', () => {
        createEditor(`<img src="${SRC}">`);
        editor.commands.updateAttributes('image', {
            href: 'https://example.com',
            target: '_blank',
        });

        const html = editor.getHTML();
        expect(html).toMatch(/<a[^>]*href="https:\/\/example\.com"[^>]*><img/);
        expect(html).toContain('rel="noopener noreferrer"');
    });

    it('a 로 감싼 이미지 HTML 을 다시 읽어도 링크가 유지된다', () => {
        createEditor(`<a href="https://example.com"><img src="${SRC}"></a>`);

        expect(editor.getAttributes('image').href).toBe('https://example.com');
        expect(editor.getHTML()).toMatch(/<a[^>]*href="https:\/\/example\.com"[^>]*><img/);
    });

    it('http·https 가 아닌 주소는 링크로 받지 않는다', () => {
        createEditor(`<img src="${SRC}">`);
        editor.commands.updateAttributes('image', { href: 'javascript:alert(1)' });

        expect(editor.getHTML()).not.toContain('<a');
    });

    it('링크가 없는 이미지는 a 태그로 감싸지 않는다', () => {
        createEditor(`<img src="${SRC}">`);

        expect(editor.getHTML()).not.toContain('<a');
    });
});

describe('CustomImage 편집 컨트롤', () => {
    it('정렬·링크 버튼은 누를 수 있는 손가락 커서를 쓴다', () => {
        createEditor(`<img src="${SRC}">`);
        editor.view.dom.querySelector('img')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const buttons = editor.view.dom.querySelectorAll<HTMLButtonElement>('button[data-image-control="button"]');
        expect(buttons.length).toBeGreaterThan(0);
        buttons.forEach((b) => expect(b.style.cursor).toBe('pointer'));
    });
});
