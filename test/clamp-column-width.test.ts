import { Editor } from '@tiptap/core';
import { TableKit } from '@tiptap/extension-table';
import { columnResizingPluginKey } from '@tiptap/pm/tables';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it } from 'vitest';

import { ClampColumnWidth } from '../src/extensions';

const TABLE_HTML =
    '<table><tbody>' +
    '<tr><td><p>a</p></td><td><p>b</p></td></tr>' +
    '<tr><td><p>c</p></td><td><p>d</p></td></tr>' +
    '</tbody></table>';

let editor: Editor;

function createEditor() {
    editor = new Editor({
        element: document.createElement('div'),
        extensions: [
            StarterKit,
            TableKit.configure({ table: { resizable: true } }),
            ClampColumnWidth,
        ],
        content: TABLE_HTML,
    });
    return editor;
}

// 첫 행 첫 셀 pos
function firstCellPos() {
    let found = -1;
    editor.state.doc.descendants((node, pos) => {
        if (found < 0 && node.type.name === 'tableCell') found = pos;
        return found < 0;
    });
    return found;
}

// jsdom 은 레이아웃이 없어 표 폭 1000, 둘째 열 화면 폭 300 으로 고정 → 첫 열이 가질 수 있는 최대 폭 700
function mockLayout() {
    const root = editor.view.dom;
    Object.defineProperty(root.querySelector('table')!, 'clientWidth', {
        value: 1000,
        configurable: true,
    });
    root.querySelectorAll('tr').forEach((tr) => {
        Object.defineProperty(tr.children[1], 'offsetWidth', { value: 300, configurable: true });
    });
}

// prosemirror-tables 가 mouseup 에서 하는 일을 그대로 흉내: 핸들 지정 → 드래그 시작 → colwidth 저장
function commitResize(cellPos: number, draggedWidth: number) {
    const { view } = editor;
    mockLayout();
    view.dispatch(view.state.tr.setMeta(columnResizingPluginKey, { setHandle: cellPos }));
    view.dispatch(
        view.state.tr.setMeta(columnResizingPluginKey, {
            setDragging: { startX: 0, startWidth: 100 },
        }),
    );

    const tr = view.state.tr;
    const $cell = view.state.doc.resolve(cellPos);
    const table = $cell.node(-1);
    const start = $cell.start(-1);
    table.descendants((node, pos) => {
        if (node.type.name !== 'tableCell') return;
        // 같은 열(첫 열)만
        if (view.state.doc.resolve(start + pos).index() !== 0) return;
        tr.setNodeMarkup(start + pos, null, { ...node.attrs, colwidth: [draggedWidth] });
    });
    view.dispatch(tr);
    view.dispatch(view.state.tr.setMeta(columnResizingPluginKey, { setDragging: null }));
}

function firstColumnWidths() {
    const widths: (number[] | null)[] = [];
    editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'tableCell' && editor.state.doc.resolve(pos).index() === 0) {
            widths.push(node.attrs.colwidth);
        }
    });
    return widths;
}

afterEach(() => {
    editor?.destroy();
});

describe('ClampColumnWidth', () => {
    it('드래그로 저장하려는 폭이 표 안에 들어갈 최대 폭보다 크면 최대 폭으로 줄여 저장한다', () => {
        createEditor();
        commitResize(firstCellPos(), 1640);
        expect(firstColumnWidths()).toEqual([[700], [700]]);
    });

    it('저장하려는 폭이 최대 폭 이하면 그대로 둔다', () => {
        createEditor();
        commitResize(firstCellPos(), 200);
        expect(firstColumnWidths()).toEqual([[200], [200]]);
    });

    it('리사이즈가 아닌 편집에는 관여하지 않는다', () => {
        createEditor();
        mockLayout();
        const pos = firstCellPos();
        const attrs = editor.state.doc.nodeAt(pos)!.attrs;
        editor.view.dispatch(
            editor.state.tr.setNodeMarkup(pos, null, { ...attrs, colwidth: [500] }),
        );
        expect(editor.state.doc.nodeAt(pos)!.attrs.colwidth).toEqual([500]);
    });
});
