import { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
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

    let imagePos = -1;
    editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'image') {
            imagePos = pos;
        }
    });
    editor.view.dispatch(
        editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, imagePos)),
    );

    return editor;
}

afterEach(() => {
    editor?.destroy();
});

describe('setImageLink 명령', () => {
    it('고른 이미지에 링크를 건다', () => {
        createEditor(`<img src="${SRC}">`);

        editor.commands.setImageLink({ href: 'example.com', target: '_blank' });

        expect(editor.getHTML()).toContain('<a href="https://example.com"');
        expect(editor.getHTML()).toContain('target="_blank"');
    });

    it('http·https 가 아닌 주소는 거절한다', () => {
        createEditor(`<img src="${SRC}">`);

        expect(editor.commands.setImageLink({ href: 'javascript:alert(1)' })).toBe(false);
        expect(editor.getHTML()).not.toContain('<a');
    });

    it('링크를 해제한다', () => {
        createEditor(`<a href="https://example.com"><img src="${SRC}"></a>`);

        editor.commands.unsetImageLink();

        expect(editor.getHTML()).not.toContain('<a');
    });
});

describe('읽기 전용 화면의 이미지 링크', () => {
    function createReadOnlyEditor(content: string, editable = false) {
        editor = new Editor({
            element: document.createElement('div'),
            extensions: [StarterKit, CustomImage],
            content,
            editable,
        });
        return editor;
    }

    it('링크가 걸린 이미지는 링크로 감싸 새 탭 설정을 따른다', () => {
        createReadOnlyEditor(
            `<a href="https://example.com" target="_blank"><img src="${SRC}"></a>`,
        );

        const link = editor.view.dom.querySelector('a');
        expect(link?.getAttribute('href')).toBe('https://example.com');
        expect(link?.getAttribute('target')).toBe('_blank');
        expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
        expect(link?.querySelector('img')).not.toBeNull();
    });

    it('같은 탭 링크는 target 없이 감싼다', () => {
        createReadOnlyEditor(`<a href="https://example.com"><img src="${SRC}"></a>`);

        const link = editor.view.dom.querySelector('a');
        expect(link?.getAttribute('href')).toBe('https://example.com');
        expect(link?.hasAttribute('target')).toBe(false);
    });

    it('링크가 없는 이미지는 감싸지 않는다', () => {
        createReadOnlyEditor(`<img src="${SRC}">`);

        expect(editor.view.dom.querySelector('a')).toBeNull();
    });

    it('편집 화면에서는 감싸지 않는다', () => {
        createReadOnlyEditor(`<a href="https://example.com"><img src="${SRC}"></a>`, true);

        expect(editor.view.dom.querySelector('a')).toBeNull();
    });
});
