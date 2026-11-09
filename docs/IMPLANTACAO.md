# Guia de implantação — NITERA Resolve

Este guia é para a equipe de TI colocar o NITERA Resolve no ar. A instalação básica está no [README](../README.md);
aqui ficam os detalhes de cada parte.

## 1. Requisitos e instalação

- Ubuntu Server 22.04 ou 24.04, 2 vCPU, 2 GB de RAM no mínimo (4 GB recomendado), 20 GB de disco além dos anexos e backups.
- Portas 80 e 443 liberadas. Com um domínio apontando para o servidor, o Caddy emite o certificado HTTPS sozinho (Let's Encrypt).
  Só na rede interna: deixe o domínio em branco no instalador (acesso por `http://IP`) ou use `tls internal` no `deploy/Caddyfile`.

```bash
git clone https://github.com/Leandromarim/Nitera_Resolve.git nitera-resolve && cd nitera-resolve
sudo bash deploy/instalar.sh
```

O instalador cria o `.env` com senhas e chaves geradas na hora (permissão 600), compila, sobe tudo e, na primeira vez,
pede o usuário, o nome e o e-mail do primeiro administrador. A **senha temporária aparece uma única vez** na tela.

> O arquivo `.env` contém segredos. Nunca o envie por e-mail, chat ou Git.

Criar ou recuperar um administrador depois (por exemplo, quando ninguém consegue entrar):
```bash
docker compose exec api node dist/scripts/criar-usuario.js --usuario LOGIN --nome "Nome Completo" [--email nome@instituicao.com.br]
docker compose exec api node dist/scripts/criar-usuario.js --usuario LOGIN --redefinir [--zerar-duas-etapas]
```

## 2. O que já vem pronto

Na primeira vez que a API sobe ela cria, uma vez só e sem apagar nada:
- as categorias de partida da TI, da Infraestrutura de TI, da Manutenção e da Comunicação, com prazos (SLA);
- os perfis Colaborador (padrão), Administrador, técnicos de cada equipe e gestores (com "Gestor da área");
- o setor "Administração" e a versão 1.0.0 em Novidades.

Depois disso, quem manda é o painel.

## 3. Primeiros ajustes no painel

1. **Instituição e aparência**: nome, logos, cores, WhatsApp e e-mail do suporte (aparecem na tela de entrar e em Meus chamados).
2. **Usuários e setores**: crie os setores da instituição, ajuste os perfis (aba Perfis) e cadastre as pessoas,
   ou importe a planilha (aceita a exportação do GLPI). Cadastre o **celular com DDD**: é assim que o WhatsApp reconhece quem abriu o chamado.
3. **Categorias e SLA**: categorias de cada equipe, prazos, prioridades, dicas, canais (WhatsApp e e-mail) e quais equipes acompanham outras, só para leitura.
   Por padrão a TI e a Manutenção acompanham a Infraestrutura de TI, e a central delas mostra a aba com as filas juntas.
4. **Mensagens automáticas**: textos dos e-mails e das mensagens do WhatsApp.
5. **Painel da TV**: gere a chave para mostrar a fila numa TV da equipe.

Tudo o que é alterado no painel fica no **Histórico de alterações**, com quem mudou, quando e o quê, e pode ser restaurado.
As ações sensíveis ficam na **Auditoria**.

## 4. WhatsApp (abertura de chamados)

Usa a **WhatsApp Business Cloud API** oficial da Meta (gratuita para mensagens iniciadas pelo usuário dentro de 24h).

1. Em <https://developers.facebook.com> crie um app do tipo *Business* e adicione o produto **WhatsApp**.
2. Registre o número do suporte (não pode estar em uso no WhatsApp comum). Se o número não aparecer na lista "De" da Configuração da API (fica numa conta separada), registre pelo servidor: `POST https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/register` com `{"messaging_product":"whatsapp","pin":"<6 dígitos>"}` e assine a conta: `POST https://graph.facebook.com/v21.0/<ID da conta de mensagens>/subscribed_apps`, os dois com o token no cabeçalho `Authorization: Bearer`.
3. Gere um **token permanente**: Configurações do negócio › Usuários do sistema › crie um usuário (função Funcionário basta), atribua só o app e a conta de mensagens do número (controle total) e gere o token sem validade com `whatsapp_business_messaging` e `whatsapp_business_management`.
   - A Meta chama a conta de WhatsApp Business (WABA) de **Conta de mensagens** (Configurações › Contas de mensagens). Em "Contas do WhatsApp" aparece o número em si; o ID dali não serve para a API.
4. Em *Configuração › Webhook* informe:
   - URL: `https://SEU_DOMINIO/api/webhooks/whatsapp`
   - Token de verificação: o mesmo valor de `WHATSAPP_VERIFY_TOKEN`
   - Assine o campo `messages`.
5. No `.env`: `WHATSAPP_ENABLED=true`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` (chave secreta do app, usada para validar a assinatura de cada mensagem).
6. Opcional: crie e aprove um *template* (ex.: `atualizacao_chamado` com uma variável) e informe em `WHATSAPP_TEMPLATE_UPDATE` para avisar o usuário fora da janela de 24h.
7. `docker compose up -d api`

Como funciona para quem pede ajuda:
- Qualquer primeira mensagem ("oi", **NOVO** ou a descrição do problema) recebe a lista das áreas para tocar (ou responder com o número). Depois vem a lista das categorias ativas daquela área, 8 por vez, com "Mais opções" e "Não sei / Outro". Se a primeira mensagem não descrevia o problema, o sistema pede a descrição no fim. O chamado é aberto com a área e a categoria escolhidas, e ele recebe o número. As duas perguntas podem ser desligadas em Categorias e SLA › Canais; as categorias vêm do cadastro da aba Categorias, na hora.
- Com chamado aberto, "oi" mostra a mesma lista com a opção "Continuar no chamado #N" no fim. "Oi" ou **NOVO** no meio das perguntas recomeça do início.
- Encaminhamento automático (Categorias e SLA › Canais): se o texto tiver uma das palavras da regra (por padrão, TI → Infraestrutura de TI com ponto de rede, cabeamento, CFTV…), o chamado vai para a outra equipe e ganha uma nota interna com a palavra. Vale também para o e-mail.
- Mandou outra mensagem (que não seja saudação) com chamado aberto: vira comentário no mesmo chamado (para abrir outro, começa com **NOVO**).
- `status 123`: consulta o andamento.
- Fotos e documentos enviados viram anexos do chamado.
- Cada resposta da equipe e mudança de status chega no WhatsApp.

> Só as mensagens do número de `WHATSAPP_PHONE_NUMBER_ID` viram chamado. Se a mesma conta do WhatsApp Business tiver outros números (por exemplo, o atendimento ao paciente de outro sistema), as mensagens deles são ignoradas. Mesmo assim, o ideal é deixar o número do suporte numa conta do WhatsApp Business separada.

> O webhook precisa ser acessível pela internet (a Meta chama a URL). Se o sistema for só interno, publique apenas o caminho `/api/webhooks/whatsapp` no firewall/proxy reverso.

## 5. E-mail (abertura de chamados)

O sistema lê a caixa do suporte a cada minuto: e-mail novo vira chamado, resposta com `[Chamado #123]` no assunto vira comentário. As respostas da equipe são enviadas por e-mail. Chamados que chegam por WhatsApp ou e-mail entram na fila da TI; a TI pode transferi-los para Manutenção ou Comunicação.

**Microsoft 365 (Outlook)** — a Microsoft não aceita mais senha em IMAP/SMTP; use OAuth2:
1. No portal do Entra ID, registre um aplicativo e crie um *client secret*.
2. Em *Permissões de API* adicione (Office 365 Exchange Online, permissões de aplicativo) `IMAP.AccessAsApp` e `SMTP.SendAsApp` e conceda consentimento de administrador.
3. No PowerShell do Exchange Online, dê acesso do app à caixa do suporte:
   ```powershell
   New-ServicePrincipal -AppId <CLIENT_ID> -ObjectId <OBJECT_ID_DO_ENTERPRISE_APP>
   Add-MailboxPermission -Identity suporte@suainstituicao.com.br -User <OBJECT_ID_DO_ENTERPRISE_APP> -AccessRights FullAccess
   Add-RecipientPermission -Identity suporte@suainstituicao.com.br -Trustee <OBJECT_ID_DO_ENTERPRISE_APP> -AccessRights SendAs
   ```
4. No `.env`: `EMAIL_ENABLED=true`, `IMAP_*`/`SMTP_*` com host e usuário, e `MAIL_OAUTH_TENANT`, `MAIL_OAUTH_CLIENT_ID`, `MAIL_OAUTH_CLIENT_SECRET`.

**Outros provedores** (Locaweb, Hostinger, servidor próprio): preencha `IMAP_PASSWORD` e `SMTP_PASSWORD` e deixe os campos `MAIL_OAUTH_*` vazios.

## 6. Backup e restauração

O serviço `backup` grava todo dia em `./backups` uma cópia do banco e um pacote dos anexos, confere se as duas abrem
e mantém 14 dias. O resultado fica em `backups/ULTIMO_OK` (ou `backups/ULTIMA_FALHA`, com o motivo em `docker compose logs backup`).
Copie a pasta `backups` para fora do servidor (NAS ou nuvem) com a rotina de backup da instituição.
Antes de cada atualização, o instalador também guarda uma cópia do banco em `../resolve-backups` (as 10 últimas).

Restaurar (apaga o conteúdo atual do banco e põe o da cópia; faça só com certeza):
```bash
docker compose exec -T postgres pg_restore -U resolve -d resolve --clean < backups/resolve_AAAA-MM-DD_HHMM.dump
docker run --rm -v nitera-resolve_uploads:/data -v $PWD/backups:/b alpine tar xzf /b/uploads_AAAA-MM-DD_HHMM.tar.gz -C /data
```

## 7. Atualizar

```bash
git pull && sudo bash deploy/instalar.sh
```
A versão nova é compilada com o sistema no ar. A tela de manutenção aparece só durante a cópia do banco e a troca dos serviços.
As mudanças do banco (migrações) rodam sozinhas ao iniciar a API e só acrescentam: nenhuma apaga dados.

Se a versão nova der problema, volte para a anterior (código e banco de antes da atualização; o banco de agora fica guardado com outro nome):
```bash
sudo bash deploy/voltar-versao.sh
```

## 8. Segurança — checklist

- [ ] `.env` com permissão 600 (o instalador já faz) e fora de qualquer backup que saia da instituição sem criptografia.
- [ ] Senha temporária do administrador trocada e verificação em duas etapas ativa para todos os administradores.
- [ ] Firewall: só 80 e 443 abertos. O PostgreSQL fica só na rede interna do Docker.
- [ ] Backups copiados para fora do servidor e restauração testada.
- [ ] Atualizações do sistema operacional e do NITERA Resolve em dia.
- [ ] Auditoria revisada de tempos em tempos.

## 9. Desenvolvimento local

```bash
pnpm install
# PostgreSQL local; crie apps/api/.env com DATABASE_URL, JWT_ACCESS_SECRET, HASH_PEPPER, COOKIE_SECURE=false
pnpm --filter api exec prisma migrate deploy
pnpm --filter api build && pnpm --filter api start        # http://localhost:4000 (ou PORT)
node apps/api/dist/scripts/criar-usuario.js --usuario admin --nome "Administrador"
pnpm dev:web                                              # http://localhost:3000
pnpm --filter api test
```
