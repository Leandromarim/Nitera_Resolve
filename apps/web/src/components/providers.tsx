'use client';

import { AuthProvider } from '@/lib/auth';
import { BrandingProvider } from '@/lib/branding';
import { TextosProvider } from '@/lib/textos-context';
import { ThemeProvider } from '@/lib/theme';
import { CookieNotice } from './cookie-notice';
import { PopupErros } from './erros/popup-erros';
import { ManutencaoWatcher } from './manutencao-watcher';
import { TabelasSemRolagem } from './tabelas-sem-rolagem';
import { Spotlight } from './ui/spotlight';
import { WhatsNew } from './novidades/whats-new';
import { ToastProvider } from './ui';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrandingProvider>
          <TextosProvider>
            <AuthProvider>
              {children}
              <WhatsNew />
              <CookieNotice />
              <ManutencaoWatcher />
              <TabelasSemRolagem />
              <Spotlight />
              <PopupErros />
            </AuthProvider>
          </TextosProvider>
        </BrandingProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
