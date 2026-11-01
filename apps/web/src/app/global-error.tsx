'use client';

import './globals.css';
import { ErroTela } from '@/components/errors/erro-tela';

export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body>
        <ErroTela {...props} />
      </body>
    </html>
  );
}
