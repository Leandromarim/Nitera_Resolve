/**
 * Cliente HTTP da API. O access token fica só em memória (nunca em localStorage);
 * o refresh token é um cookie HttpOnly que o JavaScript não consegue ler.
 */
import { emManutencao } from './manutencao';
import { avisarErroCampos, camposDoErro } from './erros-campos';

export type Role = 'ADMIN' | 'TI' | 'INFRAESTRUTURA' | 'MANUTENCAO' | 'COMUNICACAO' | 'GESTOR_AREA' | 'COLABORADOR';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  username: string;
  roles: Role[];
  avatarUrl?: string | null;
  jobTitle?: string | null;
  /** ramal do cadastro */
  extension?: string | null;
  departmentId?: string | null;
  totpEnabled: boolean;
  mustChangePassword: boolean;
  /** o perfil exige verificação em duas etapas e a pessoa ainda não ativou: só o Meu perfil abre */
  duasEtapasPendente?: boolean;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: any) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<(u: SessionUser | null) => void>();

export const getAccessToken = () => accessToken;
export const onSessionChange = (fn: (u: SessionUser | null) => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function setSession(token: string | null, user: SessionUser | null) {
  accessToken = token;
  listeners.forEach((l) => l(user));
}

/** Renova o access token usando o cookie de refresh. Chamadas simultâneas compartilham a mesma renovação. */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    // uma aba por vez: duas abas trocando o mesmo cookie ao mesmo tempo derrubavam a sessão
    const pedir = () => fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    refreshing = ((locks ? locks.request('nr-refresh', pedir) : pedir()) as Promise<Response>)
      .then(async (r) => {
        if (emManutencao(r)) return false;
        if (!r.ok) {
          // só 401/403 encerram a sessão; erro do servidor (5xx) não desloga ninguém
          if (r.status < 500) setSession(null, null);
          return false;
        }
        const data = await r.json();
        setSession(data.accessToken, data.user);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (refreshing = null), 0);
      });
  }
  return refreshing;
}

function messageOf(body: any, status: number) {
  const m = body?.message;
  if (Array.isArray(m)) return m.join('. ');
  if (typeof m === 'string') return m;
  if (status === 429) return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  if (status >= 500) return 'Erro no servidor. Tente novamente em instantes.';
  return 'Não foi possível concluir a ação.';
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown; retry?: boolean } = {}): Promise<T> {
  const { json, retry = true, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(`/api${path}`, {
    ...rest,
    headers,
    credentials: 'include',
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  emManutencao(res);
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, { ...init, retry: false });
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = messageOf(body, res.status);
    // preenchimento recusado: o pop-up global aponta o campo exato
    if (res.status === 400) avisarErroCampos(camposDoErro(body), msg);
    throw new ApiError(res.status, msg, body);
  }
  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('application/json') ? res.json() : res.text()) as Promise<T>;
}

export interface UploadedFile {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export function uploadFile(file: File, opts: { public?: boolean; images?: boolean; avatar?: boolean; chat?: boolean; voz?: boolean } = {}, onProgress?: (p: number) => void): Promise<UploadedFile> {
  const send = () =>
    new Promise<UploadedFile>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const qs = new URLSearchParams({ ...(opts.public ? { public: '1' } : {}), ...(opts.images ? { images: '1' } : {}), ...(opts.avatar ? { avatar: '1' } : {}) });
      // anexos do chat têm rota própria: qualquer tipo, até 200 MB
      xhr.open('POST', opts.chat ? `/api/files/chat${opts.voz ? '?voz=1' : ''}` : `/api/files?${qs}`);
      if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        let body: any = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {}
        if (xhr.status >= 200 && xhr.status < 300) resolve(body);
        else reject(new ApiError(xhr.status, messageOf(body, xhr.status), body));
      };
      xhr.onerror = () => reject(new ApiError(0, 'Falha de conexão no envio'));
      const fd = new FormData();
      fd.append('file', file);
      xhr.send(fd);
    });
  return send().catch(async (e) => {
    if (e instanceof ApiError && e.status === 401 && (await refreshSession())) return send();
    throw e;
  });
}

/** Busca um arquivo autenticado (relatórios) como blob, com o nome sugerido pelo servidor. */
export async function fetchAuthenticated(path: string): Promise<{ blob: Blob; name: string | null }> {
  const go = () => fetch(`/api${path}`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, credentials: 'include' });
  let res = await go();
  if (res.status === 401 && (await refreshSession())) res = await go();
  if (!res.ok) {
    let body: any = {};
    try {
      body = await res.json();
    } catch {}
    throw new ApiError(res.status, body?.message && typeof body.message === 'string' ? body.message : 'Falha ao gerar o arquivo', body);
  }
  return { blob: await res.blob(), name: /filename="?([^"]+)"?/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? null };
}

/** Baixa um arquivo autenticado (relatórios) e dispara o download no navegador. */
export async function downloadAuthenticated(path: string, fallbackName: string) {
  const { blob, name: sugerido } = await fetchAuthenticated(path);
  const name = sugerido ?? fallbackName;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
