import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { columnResizingPluginKey, TableMap } from '@tiptap/pm/tables';

const CELL_MIN_WIDTH = 25;

// 열 리사이즈 확정 시 저장 colwidth 를 "표가 에디터 폭 안에 들어가는 최대값" 으로 맞춘다 — 캡 너머로 끈 값이 남으면 다른 열이 눌리고 다음 드래그가 먹통
export const ClampColumnWidth = Extension.create({
    name: 'clampColumnWidth',

    addProseMirrorPlugins() {
        const { editor } = this;

        return [
            new Plugin({
                appendTransaction(transactions, oldState, newState) {
                    const resize = columnResizingPluginKey.getState(oldState);
                    if (!resize?.dragging || resize.activeHandle < 0) return null;
                    if (!transactions.some((tr) => tr.docChanged)) return null;

                    const cellPos = transactions.reduce(
                        (pos, tr) => tr.mapping.map(pos),
                        resize.activeHandle,
                    );
                    const $cell = newState.doc.resolve(cellPos);
                    const cell = $cell.nodeAfter;
                    // 병합 셀은 화면 폭이 여러 열의 합이라 어느 열 값인지 알 수 없어 건너뛴다.
                    if (!cell || cell.attrs.colspan !== 1) return null;

                    const table = $cell.node(-1);
                    const map = TableMap.get(table);
                    const start = $cell.start(-1);
                    const col = map.colCount($cell.pos - start);

                    // 이 시점의 DOM 은 아직 이전 state 기준이라 pos 도 oldState 것을 그대로 쓴다.
                    const tableDom = editor.view.nodeDOM(start - 1);
                    if (!(tableDom instanceof HTMLElement)) return null;
                    const tableEl = tableDom.querySelector('table') ?? tableDom;
                    if (!tableEl.clientWidth) return null;

                    // 첫 행 기준으로 다른 열들이 차지하는 폭(저장 px 가 있으면 그 값, 없으면 화면 폭)을 빼면 이 열이 가질 수 있는 최대 폭.
                    let others = 0;
                    for (let c = 0; c < map.width; c += 1) {
                        const pos = map.map[c];
                        if (c && pos === map.map[c - 1]) continue;
                        const attrs = table.nodeAt(pos)!.attrs;
                        const covers = c <= col && col < c + attrs.colspan;
                        if (covers) continue;
                        const dom = editor.view.nodeDOM(start + pos);
                        const domWidth = dom instanceof HTMLElement ? dom.offsetWidth : 0;
                        const storedSum = (attrs.colwidth as number[] | null)?.every(Boolean)
                            ? attrs.colwidth.reduce((a: number, b: number) => a + b, 0)
                            : 0;
                        others += storedSum || domWidth;
                    }
                    const allowed = Math.max(CELL_MIN_WIDTH, tableEl.clientWidth - others);

                    const tr = newState.tr;
                    for (let row = 0; row < map.height; row += 1) {
                        const pos = map.map[row * map.width + col];
                        if (row && pos === map.map[(row - 1) * map.width + col]) continue;
                        const attrs = table.nodeAt(pos)!.attrs;
                        const index = attrs.colspan === 1 ? 0 : col - map.colCount(pos);
                        const stored: number | undefined = attrs.colwidth?.[index];
                        if (!stored || stored <= allowed) continue;
                        const colwidth = [...attrs.colwidth];
                        colwidth[index] = allowed;
                        tr.setNodeMarkup(start + pos, null, { ...attrs, colwidth });
                    }

                    return tr.docChanged ? tr : null;
                },
            }),
        ];
    },
});
