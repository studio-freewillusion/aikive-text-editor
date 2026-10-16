const VIDEO_ID = /^(?!\d+$)[A-Za-z0-9_-]{1,64}$/;
const EMBED_PATH = /^\/embed\/watch\/([A-Za-z0-9_-]{1,64})$/;

export interface AikiveVideoRef {
  host: string;
  id: string;
}

const isAllowedOrigin = (url: URL, hosts: readonly string[]) =>
  url.protocol === 'https:' &&
  !url.port &&
  !url.username &&
  !url.password &&
  hosts.some((host) => host.toLowerCase() === url.hostname);

export function parseAikiveVideoUrl(input: string, hosts: readonly string[]): AikiveVideoRef | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (!isAllowedOrigin(url, hosts)) return null;
  if (url.pathname === '/watch') {
    const id = url.searchParams.get('v') ?? '';
    return VIDEO_ID.test(id) ? { host: url.hostname, id } : null;
  }
  const id = EMBED_PATH.exec(url.pathname)?.[1];
  return id && VIDEO_ID.test(id) && !url.search && !url.hash ? { host: url.hostname, id } : null;
}

export const aikiveEmbedSrc = ({ host, id }: AikiveVideoRef): string => `https://${host}/embed/watch/${id}`;

// URL 이 고쳐 읽는 변형(대문자 호스트·끝 # · /../)까지 막으려고 만든 주소와 글자를 맞춰 본다
export function isAikiveEmbedSrc(src: string, hosts: readonly string[]): boolean {
  const ref = parseAikiveVideoUrl(src, hosts);
  return !!ref && aikiveEmbedSrc(ref) === src;
}
