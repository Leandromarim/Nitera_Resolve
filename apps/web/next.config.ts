import type { NextConfig } from 'next';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Versões instaladas das bibliotecas do portal, lidas no build ("Tecnologias" em /novidades).
 * Cada atualização refaz o build, então a lista acompanha sozinha o que entrar ou sair do package.json.
 */
function bibliotecasDoPortal() {
  const ler = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
  const pkg = ler(join(__dirname, 'package.json'));
  const todas = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
  const out: Record<string, string> = {};
  for (const [nome, pedida] of Object.entries(todas)) {
    if (nome.startsWith('@types/')) continue;
    let versao = pedida.replace(/^[\^~>=<\s]+/, '');
    for (const base of [join(__dirname, 'node_modules'), join(__dirname, '..', '..', 'node_modules')]) {
      try {
        versao = ler(join(base, nome, 'package.json')).version ?? versao;
        break;
      } catch {
        // tenta a próxima pasta
      }
    }
    out[nome] = versao;
  }
  return JSON.stringify(out);
}

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
// A política de segurança de conteúdo (CSP) das páginas fica em src/middleware.ts: leva um código novo a cada página.

const config: NextConfig = {
  output: 'standalone',
  env: { NEXT_PUBLIC_BIBLIOTECAS: bibliotecasDoPortal() },
  poweredByHeader: false,
  // a compressão fica com o Caddy (zstd/gzip, em Go, mais leve que no Node): o Node não comprime de novo
  compress: false,
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default config;
