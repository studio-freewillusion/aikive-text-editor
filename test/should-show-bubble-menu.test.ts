import { Editor } from '@tiptap/core';
import { TableKit } from '@tiptap/extension-table';
import { NodeSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it } from 'vitest';

import { CustomImage } from '../src/extensions';
import { shouldShowBubbleMenu } from '../src/ui/should-show-bubble-menu';

let editor: Editor;

function createEditor(content: string) {
    editor = new Editor({
        element: document.createElement('div'),
        extensions: [StarterKit, TableKit, CustomImage],
        content,
    });
    return editor;
}

const check = () => shouldShowBubbleMenu({ editor, state: editor.state });

afterEach(() => {
    editor?.destroy();
});

describe('shouldShowBubbleMenu', () => {
    it('글자를 고르면 띄운다', () => {
        createEditor('<p>안녕하세요</p>');
        editor.commands.setTextSelection({ from: 1, to: 4 });

        expect(check()).toBe(true);
    });

    it('고른 것이 없으면 띄우지 않는다', () => {
        createEditor('<p>안녕하세요</p>');
        editor.commands.setTextSelection(2);

        expect(check()).toBe(false);
    });

    it('표 안에 커서만 있어도 띄운다', () => {
        createEditor('<table><tbody><tr><td><p>칸</p></td></tr></tbody></table>');
        editor.commands.setTextSelection(4);

        expect(editor.isActive('table')).toBe(true);
        expect(check()).toBe(true);
    });

    it('이미지를 고르면 띄우지 않는다', () => {
        createEditor('<img src="https://cdn.example.com/a.png">');
        let imagePos = -1;
        editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'image') {
                imagePos = pos;
            }
        });
        editor.view.dispatch(
            editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, imagePos)),
        );

        expect(check()).toBe(false);
    });
});
