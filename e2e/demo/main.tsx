import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AikiveTextEditor, type AikiveTextEditorHandle } from '../../src/editor';
import { AikiveTextViewer } from '../../src/viewer';
import '../../src/styles/index.css';

const params = new URLSearchParams(location.search);
const EMBED_HOSTS = ['video.example.com'];

function Demo() {
  const ref = useRef<AikiveTextEditorHandle>(null);
  const [html, setHtml] = useState(params.get('content') ?? '<p>시작</p>');
  const [notices, setNotices] = useState<string[]>([]);
  const [editable, setEditable] = useState(params.get('editable') !== 'false');
  return (
    <main>
      <button type="button" onClick={() => setEditable((v) => !v)}>
        편집 전환
      </button>
      <AikiveTextEditor
        ref={ref}
        editable={editable}
        initialContent={html}
        toolbar={params.get('toolbar') === 'bubble' ? 'bubble' : 'fixed'}
        onChange={setHtml}
        onUploadImage={async (f) => URL.createObjectURL(f)}
        onNotice={(m) => setNotices((n) => [...n, m])}
        embedHosts={EMBED_HOSTS}
      />
      <output data-testid="html">{html}</output>
      <ul data-testid="notices">
        {notices.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
      <section data-testid="viewer">
        <AikiveTextViewer content={html} embedHosts={EMBED_HOSTS} />
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Demo />);
