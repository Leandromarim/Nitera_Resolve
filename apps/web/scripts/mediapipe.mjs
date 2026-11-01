// Copia os arquivos do detector de rostos (fotos de colaboradores e médicos) para public/, onde o navegador os busca.
import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const pacote = dirname(createRequire(import.meta.url).resolve('@mediapipe/tasks-vision'));
mkdirSync('public/mediapipe/wasm', { recursive: true });
cpSync(join(pacote, 'wasm'), 'public/mediapipe/wasm', { recursive: true });
