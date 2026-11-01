# Arquitetura — NITERA Resolve

Central de chamados para as equipes de TI, Infraestrutura de TI, Manutenção e Comunicação. Quem precisa de ajuda
abre o chamado pelo site, pelo WhatsApp ou por e-mail; a equipe atende pela central, com prazos (SLA), quadro,
lista, relatórios e um painel para TV.

O NITERA Resolve nasceu do sistema de chamados da Intranet 4.0 e virou um produto separado, com banco, contas e
instalação próprios. Ele não depende da intranet nem do NITERA Qualis.

```
             ┌──────────────────────── Navegador ────────────────────────┐
             │  Abrir e acompanhar  │  Central de atendimento  │  Painel  │
             └───────────────┬───────────────────────────────────────────┘
                             │ HTTPS (Caddy: certificado, compressão, tela de manutenção)
             ┌───────────────▼──────────────┐      ┌─────────────────────┐
             │ Site (Next.js 15, React 19)  │─────▶│ API (NestJS 11)     │
             └──────────────────────────────┘ /api │ login · chamados ·  │
                                                   │ relatórios · anexos │
        WhatsApp Cloud API ── webhook ────────────▶│ · auditoria ·       │
        E-mail (IMAP/SMTP) ── leitura a cada min ─▶│ histórico           │
                                                   └──┬──────────────┬───┘
                                                      │              │
                                            PostgreSQL 16      Anexos (volume privado,
                                            (Prisma 6)         servidos pela API)
```

## Stack

| Camada | Tecnologia |
|---|---|
| Site | Next.js 15 (App Router), React 19, Tailwind CSS 4 |
| API | NestJS 11, TypeScript, Prisma 6 |
| Banco | PostgreSQL 16 |
| Servidor | Docker Compose: PostgreSQL, API, site, Caddy 2 e backup diário |

## Pastas

```
apps/api/src
  auth/          login, renovação de sessão, duas etapas (TOTP), esqueci minha senha
  tickets/       chamados, categorias, SLA, relatórios, painel da TV, configuração das equipes
  integrations/  WhatsApp Cloud API e e-mail (IMAP/SMTP, OAuth2 do Microsoft 365)
  users/         usuários, perfis, categorias, grupos, setores, importação e exportação
  files/         anexos privados, otimização de imagens e armazenamento
  versions/      histórico de alterações do painel (com restauração)
  novidades/     versões e "O que há de novo"
  mensagens/     textos dos e-mails e das mensagens automáticas
  settings/      instituição e aparência, textos das telas, QR Code
  notificacoes/  avisos do sino (gerados pelos chamados)
  bootstrap/     carga inicial de uma instalação nova (uma vez só)
  scripts/       criar-usuario (primeiro administrador e recuperação de acesso)
apps/web/src
  app/(portal)   chamados, novidades e perfil
  app/admin      painel (categorias e SLA, usuários, aparência, mensagens, histórico, auditoria…)
  components/tickets  central de atendimento, abertura, detalhe, relatórios
```

## Equipes e permissões

- Cada pessoa tem um **perfil** (Usuários › Perfis), que copia as permissões para a conta: `ADMIN`, `TI`,
  `INFRAESTRUTURA`, `MANUTENCAO`, `COMUNICACAO`, `GESTOR_AREA` e `COLABORADOR`.
- Técnico atende só os chamados da própria equipe; o administrador atende todas.
- **Equipes acompanhadas** (Categorias e SLA › Setores): uma equipe pode ver os chamados de outra **só para leitura**,
  sem notas internas, sem responder e sem mudar nada. Cada equipe escolhe se isso vale para a equipe toda ou só para
  quem tem "Gestor da área". Padrão: TI e Manutenção acompanham a Infraestrutura de TI; o gestor da Infraestrutura acompanha a Manutenção.
  A central mostra a aba com a própria fila e as acompanhadas juntas.
- Toda regra é conferida na API em cada pedido; esconder um botão na tela nunca é a proteção.

## Segurança

- Senhas com Argon2id; bloqueio temporário depois de tentativas erradas; limite de pedidos por minuto (Throttler).
- Sessão curta (JWT) com renovação por cookie `HttpOnly` e `SameSite`, girado a cada uso; verificação em duas etapas (TOTP).
- Senha temporária obrigatória de trocar; conta com validade; senha provisória simples que só deixa trocar a senha.
- Anexos fora da pasta pública, entregues pela API só para quem pode ver o chamado.
- HTML de textos ricos limpo no servidor (sanitize-html); política de segurança de conteúdo (CSP) com código novo a cada página.
- Webhook do WhatsApp com assinatura conferida (`WHATSAPP_APP_SECRET`) e só o número configurado vira chamado.
- Auditoria das ações sensíveis e histórico de alterações do painel com restauração.
- Segredos só no `.env` (permissão 600), gerados pelo instalador; nada de segredo no código.

## Banco de dados

- Migrações em `apps/api/prisma/migrations`, aplicadas ao iniciar a API (`prisma migrate deploy`). Só acrescentam: nenhuma apaga dados.
- A carga inicial (`bootstrap.service.ts`) roda uma vez, marcada pelo Setting `_bootstrap.v1`, e só cria o que não existe.
- Backup diário conferido (banco e anexos, 14 dias) e cópia do banco antes de cada atualização.
