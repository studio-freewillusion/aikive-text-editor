import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AikiveTextViewer } from '../src/viewer';

const SRC = 'https://cdn.example.com/public/a.png';
const resolve = (s: string) => `${s}?w=1640`;

describe('AikiveTextViewer', () => {
  it('내용이 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<AikiveTextViewer content="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('HTML 이미지는 리사이즈 주소로 그리고 클릭하면 원본으로 확대한다', async () => {
    const onClickImage = vi.fn();
    render(<AikiveTextViewer content={`<p>글</p><img src="${SRC}" alt="본문">`} resolveImageSrc={resolve} onClickImage={onClickImage} />);
    const img = screen.getByRole('img', { name: '본문' });
    expect(img).toHaveAttribute('src', `${SRC}?w=1640`);
    await userEvent.setup().click(img);
    expect(onClickImage).toHaveBeenCalledWith(SRC);
  });

  it('링크가 걸린 이미지는 확대하지 않는다', async () => {
    const onClickImage = vi.fn();
    render(<AikiveTextViewer content={`<a href="https://a.example.com"><img src="${SRC}" alt="링크"></a>`} onClickImage={onClickImage} />);
    await userEvent.setup().click(screen.getByRole('img', { name: '링크' }));
    expect(onClickImage).not.toHaveBeenCalled();
  });

  it('resolveImageSrc 가 없으면 원본 주소를 그대로 쓴다', () => {
    render(<AikiveTextViewer content={`<img src="${SRC}" alt="x">`} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', SRC);
  });

  it('옛 JSON 문서도 같은 컴포넌트로 그린다', () => {
    const doc = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '옛 글' }] }] });
    render(<AikiveTextViewer content={doc} />);
    expect(screen.getByText('옛 글')).toBeInTheDocument();
  });

  it('루트에 tiptap 클래스와 넘긴 className 을 붙인다', () => {
    const { container } = render(<AikiveTextViewer content="<p>a</p>" className="detail" />);
    expect(container.firstChild).toHaveClass('tiptap', 'detail');
  });

  it('p 안 블록 요소가 있는 옛 HTML 도 div 를 p 안에 두지 않는다', () => {
    const { container } = render(<AikiveTextViewer content="<p>앞<div>블록</div>뒤</p>" />);
    expect(container.querySelector('p div')).toBeNull();
    expect(container).toHaveTextContent('앞블록뒤');
  });

  it('extraIframeHosts 로 넘긴 호스트의 iframe 만 남긴다', () => {
    const html = '<iframe src="https://video.example.com/embed/1"></iframe>';
    const { container, rerender } = render(<AikiveTextViewer content={html} />);
    expect(container.querySelector('iframe')).toBeNull();
    rerender(<AikiveTextViewer content={html} extraIframeHosts={['video.example.com']} />);
    expect(container.querySelector('iframe')).not.toBeNull();
  });
});
