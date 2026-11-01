import { NextResponse, type NextRequest } from 'next/server';

const dev = process.env.NODE_ENV !== 'production';

/**
 * Política de segurança de conteúdo com um código novo (nonce) a cada página: só rodam os scripts da própria intranet
 * que levam esse código. Um script injetado no meio do conteúdo não roda, mesmo que passe por algum filtro.
 * O Next coloca o nonce nos scripts dele sozinho ao achar a política no pedido; o script do tema lê em x-nonce.
 */
export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    "default-src 'self'",
    // YouTube IFrame API (player dos treinamentos)
    // 'wasm-unsafe-eval': detector de rostos das fotos (MediaPipe, WebAssembly servido pela própria intranet)
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ''} https://www.youtube.com https://s.ytimg.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ws: wss:${dev ? ' http://localhost:4000' : ''}`,
    "media-src 'self' blob:",
    'frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com https://docs.google.com https://forms.office.com https://forms.microsoft.com https://app.powerbi.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  // páginas (não a API, os arquivos do build nem as imagens da pasta public)
  matcher: [{ source: '/((?!api/|_next/static|_next/image|favicon|apple-touch-icon|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?|wasm|tflite|task|js|css|map)$).*)' }],
};
