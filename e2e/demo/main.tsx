import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AikiveTextEditor, type AikiveTextEditorHandle } from '../../src/editor';
import { AikiveTextViewer } from '../../src/viewer';
import '../../src/styles/index.css';

const params = new URLSearchParams(location.search);

function Demo() {
  const ref = useRef<AikiveTextEditorHandle>(null);
  const [html, setHtml] = useState(params.get('content') ?? '<p>시작</p>');
  const [notices, setNotices] = useState<string[]>([]);
  return (
    <main>
      <AikiveTextEditor
        ref={ref}
        initialContent={html}
        toolbar={params.get('toolbar') === 'bubble' ? 'bubble' : 'fixed'}
        onChange={setHtml}
        onUploadImage={async (f) => URL.createObjectURL(f)}
        onNotice={(m) => setNotices((n) => [...n, m])}
      />
      <output data-testid="html">{html}</output>
      <ul data-testid="notices">
        {notices.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
      <section data-testid="viewer">
        <AikiveTextViewer content={html} />
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Demo />);
