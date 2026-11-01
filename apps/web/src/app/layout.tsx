import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { Providers } from '@/components/providers';
import { themeScript } from '@/lib/theme';
import { VALORES_PADRAO, resolverTexto } from '@/lib/textos';

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/** Lê da API no servidor, com cache de 5 min; se a API não responder, a tela usa os padrões. */
async function fromApi<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API}/api${path}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(2000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Título da aba e descrição a partir do nome do hospital (Configurações) e de Painel › Textos da intranet. */
export async function generateMetadata(): Promise<Metadata> {
  const [branding, textos] = await Promise.all([
    fromApi<{ siteName?: string; siteTagline?: string }>('/branding'),
    fromApi<{ textos?: Record<string, string> }>('/textos'),
  ]);
  const vars = { site: branding?.siteName || VALORES_PADRAO.site, tagline: branding?.siteTagline || VALORES_PADRAO.tagline };
  const salvos = textos?.textos && typeof textos.textos === 'object' ? textos.textos : null;
  return {
    title: {
      default: resolverTexto('site.titulo-aba', salvos, vars),
      template: resolverTexto('site.titulo-aba-pagina', salvos, { ...vars, pagina: '%s' }),
    },
    description: resolverTexto('site.descricao', salvos, vars),
    robots: { index: false, follow: false },
    icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3c4b78' },
    { media: '(prefers-color-scheme: dark)', color: '#141b33' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // código da política de segurança desta página (src/middleware.ts): sem ele o navegador não roda o script do tema
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
