import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderLegacyJson } from '../src/viewer/render-legacy-json';

const TiptapStaticContent = ({ content, onClickImage }: { content: string; onClickImage?: (src: string) => void }) => (
    <div className="tiptap">
        {renderLegacyJson(JSON.parse(content), { onClickImage, resolveImageSrc: (src) => `${src}?w=1640` })}
    </div>
);

const CDN_SRC = 'https://cdn.example.com/public/posts/a.png';

const content = JSON.stringify({
    type: 'doc',
    content: [{ type: 'customImage', attrs: { src: CDN_SRC, alt: '본문 이미지' } }],
});

const linkedContent = JSON.stringify({
    type: 'doc',
    content: [
        {
            type: 'customImage',
            attrs: {
                src: CDN_SRC,
                alt: '본문 이미지',
                href: 'https://example.com',
                target: '_blank',
            },
        },
    ],
});

describe('renderLegacyJson', () => {
    it('본문 이미지는 표시 폭에 맞춘 리사이즈 URL로 렌더한다', () => {
        render(<TiptapStaticContent content={content} />);

        expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('w=1640'));
    });

    it('이미지 클릭 확대에는 원본 URL을 전달한다', async () => {
        const user = userEvent.setup();
        const onClickImage = vi.fn();

        render(<TiptapStaticContent content={content} onClickImage={onClickImage} />);
        await user.click(screen.getByRole('img'));

        expect(onClickImage).toHaveBeenCalledWith(CDN_SRC);
    });

    it('링크가 걸린 이미지는 링크로 감싸 렌더한다', () => {
        render(<TiptapStaticContent content={linkedContent} />);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', 'https://example.com');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toContainElement(screen.getByRole('img'));
    });

    it('링크가 걸린 이미지는 클릭해도 확대를 부르지 않는다', async () => {
        const user = userEvent.setup();
        const onClickImage = vi.fn();

        render(
            <TiptapStaticContent content={linkedContent} onClickImage={onClickImage} />,
        );
        await user.click(screen.getByRole('img'));

        expect(onClickImage).not.toHaveBeenCalled();
    });

    it('본문 영상을 video 태그로 렌더한다', () => {
        const videoContent = JSON.stringify({
            type: 'doc',
            content: [
                { type: 'videoBlock', attrs: { src: 'https://cdn.example.com/public/a.mp4' } },
            ],
        });

        const { container } = render(<TiptapStaticContent content={videoContent} />);

        const video = container.querySelector('video');
        expect(video).toHaveAttribute('src', 'https://cdn.example.com/public/a.mp4');
        expect(video).toHaveAttribute('controls');
    });

    it('이모지를 문자로 렌더한다', async () => {
        const emojiContent = JSON.stringify({
            type: 'doc',
            content: [
                { type: 'paragraph', content: [{ type: 'emoji', attrs: { name: 'smile' } }] },
            ],
        });

        render(<TiptapStaticContent content={emojiContent} />);

        expect(await screen.findByText('\u{1F604}')).toBeInTheDocument();
    });

    it('코드 블록은 줄바꿈이 유지되도록 pre 안 code 로 렌더한다', () => {
        const codeContent = JSON.stringify({
            type: 'doc',
            content: [
                {
                    type: 'codeBlock',
                    attrs: { language: null },
                    content: [{ type: 'text', text: 'const a = 1;\nconst b = 2;' }],
                },
            ],
        });

        const { container } = render(<TiptapStaticContent content={codeContent} />);

        expect(container.querySelector('pre > code')).toHaveTextContent(
            /const a = 1;\s*const b = 2;/,
        );
    });

    it('표를 table 구조 그대로 렌더한다', () => {
        const tableContent = JSON.stringify({
            type: 'doc',
            content: [
                {
                    type: 'table',
                    content: [
                        {
                            type: 'tableRow',
                            content: [
                                {
                                    type: 'tableHeader',
                                    attrs: { colspan: 2, colwidth: [120] },
                                    content: [
                                        {
                                            type: 'paragraph',
                                            content: [{ type: 'text', text: '머리' }],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            type: 'tableRow',
                            content: [
                                {
                                    type: 'tableCell',
                                    content: [
                                        {
                                            type: 'paragraph',
                                            content: [{ type: 'text', text: '값1' }],
                                        },
                                    ],
                                },
                                {
                                    type: 'tableCell',
                                    content: [
                                        {
                                            type: 'paragraph',
                                            content: [{ type: 'text', text: '값2' }],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        const { container } = render(<TiptapStaticContent content={tableContent} />);

        expect(container.querySelector('table')).toBeInTheDocument();
        expect(container.querySelectorAll('tr')).toHaveLength(2);
        expect(container.querySelectorAll('td')).toHaveLength(2);

        const header = container.querySelector('th');
        expect(header).toHaveTextContent('머리');
        expect(header).toHaveAttribute('colspan', '2');
        expect(header).toHaveStyle({ width: '120px' });
    });
    it('위험한 스킴의 링크는 주소를 넣지 않고 안전한 링크는 그대로 둔다', () => {
        const linkDoc = (href: string) => ({
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }] }],
        });
        const hrefs = ['javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', 'https://example.com', 'mailto:a@example.com', '/rel'];
        const { container } = render(<div>{hrefs.map((h) => renderLegacyJson(linkDoc(h), { resolveImageSrc: (s) => s }))}</div>);
        const got = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
        expect(got).toEqual([null, null, null, 'https://example.com', 'mailto:a@example.com', '/rel']);
    });
});
