#!/usr/bin/env bash
# Instala e sobe o NITERA Resolve em um servidor Ubuntu novo (VPS, nuvem ou servidor local).
# Uso, dentro da pasta do projeto:  sudo bash deploy/instalar.sh
# Pode ser executado de novo para atualizar: mantém o .env e os dados existentes.
set -euo pipefail

cd "$(dirname "$0")/.."
verde() { printf '\033[1;32m%s\033[0m\n' "$*"; }
aviso() { printf '\033[1;33m%s\033[0m\n' "$*"; }
erro() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || erro "Rode como administrador: sudo bash deploy/instalar.sh"

# 1. Memória de troca (a compilação precisa de ~3 GB; servidores pequenos travam sem ela)
mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$mem_mb" -lt 3800 ] && ! swapon --show | grep -q .; then
  verde "» Criando 4 GB de memória de troca (servidor com ${mem_mb} MB de RAM)…"
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 2. Docker
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  verde "» Instalando o Docker…"
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true

# 3. Configuração (.env)
if [ -f .env ]; then
  aviso "» Já existe um arquivo .env: vou usar a configuração atual (apague-o para configurar do zero)."
else
  verde "» Configuração inicial"
  ip_publico=$(curl -fsS --max-time 5 https://checkip.amazonaws.com 2>/dev/null || hostname -I | awk '{print $1}')
  echo
  echo "Domínio do sistema (ex.: chamados.suainstituicao.com.br)."
  echo "O domínio já precisa apontar para o IP deste servidor: ${ip_publico}"
  read -rp "Deixe em branco para usar só o IP por enquanto (sem HTTPS): " dominio
  dominio=$(echo "$dominio" | sed -E 's#^https?://##; s#/.*$##')

  read -rp "Nome da instituição (aparece nas telas e nos e-mails; dá para mudar depois no sistema): " inst_nome
  inst_nome=$(echo "$inst_nome" | tr -d "'\"\n" | cut -c1-120)

  gerar() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-48; }
  if [ -n "$dominio" ]; then
    site="$dominio"; url="https://$dominio"; cookie_secure=true
  else
    site=":80"; url="http://$ip_publico"; cookie_secure=false
  fi

  cp .env.example .env
  set_env() { # troca VAR=... no .env sem depender de caracteres especiais
    python3 - "$1" "$2" <<'PY'
import sys, re
k, v = sys.argv[1], sys.argv[2]
s = open('.env').read()
s = re.sub(rf'^{k}=.*$', lambda m: f'{k}={v}', s, flags=re.M)
open('.env', 'w').write(s)
PY
  }
  set_env SITE_ADDRESS "$site"
  set_env PUBLIC_URL "$url"
  set_env COOKIE_SECURE "$cookie_secure"
  set_env POSTGRES_PASSWORD "$(gerar)"
  set_env JWT_ACCESS_SECRET "$(gerar)"
  set_env HASH_PEPPER "$(gerar)"
  set_env WHATSAPP_VERIFY_TOKEN "$(gerar)"
  # entre aspas simples: o Docker não trata espaços nem "$" do nome como variável
  [ -n "$inst_nome" ] && set_env INSTITUICAO_NOME "'$inst_nome'"
  chmod 600 .env
  verde "» Arquivo .env criado (senhas e chaves geradas automaticamente)."
fi

# Compilação: na atualização ela é feita ANTES da tela de manutenção, com o sistema no ar (os containers
# em execução continuam usando as imagens antigas até o "up"). Fora do ar fica só o tempo de copiar o
# banco e trocar os containers. Em servidores com pouca memória compila uma parte de cada vez, sem disputar a RAM.
inicio_total=$(date +%s)
compilar() {
  local inicio; inicio=$(date +%s)
  if [ "$mem_mb" -lt 3800 ]; then docker compose build api && docker compose build web; else docker compose build; fi
  duracao_compilacao=$(( $(date +%s) - inicio ))
  echo "$duracao_compilacao" > .duracao-compilacao
}
compilado=0
if [ -f .instalado ] && docker compose ps --status running postgres 2>/dev/null | grep -q postgres; then
  # se alguém ligou a tela à mão, ela sai: o sistema volta durante a compilação
  rm -f deploy/manutencao/ATIVA deploy/manutencao/progresso.json
  verde "» Compilando a versão nova com o sistema no ar. Isso leva alguns minutos e ninguém é interrompido…"
  compilar || erro "A compilação falhou. O sistema continua no ar na versão anterior; nada foi alterado no banco."
  compilado=1
  verde "» Compilação concluída em $(( duracao_compilacao / 60 )) min $(( duracao_compilacao % 60 )) s."
fi

# 4. Tela "Sistema em manutenção" (deploy/manutencao) durante toda a atualização: quem abrir o sistema
#    vê o aviso, e ninguém grava nada enquanto o banco é copiado. Sai sozinha no fim, mesmo se o
#    instalador parar com erro; se o sistema não subir, o Caddy continua mostrando a tela.
# Barra de progresso da tela: cada etapa grava deploy/manutencao/progresso.json (de % até %, texto e,
# na compilação, quanto tempo a última levou, para a tela estimar o andamento dentro da etapa).
progresso() { # progresso <etapa> <de %> <até %> <texto> [segundos estimados]
  local agora; agora=$(date -u +%FT%TZ)
  printf '{"etapa":%s,"total":6,"de":%s,"ate":%s,"texto":"%s","estimativa":%s,"inicio":"%s"}\n' \
    "$1" "$2" "$3" "$4" "${5:-0}" "$agora" > deploy/manutencao/progresso.json.tmp
  mv -f deploy/manutencao/progresso.json.tmp deploy/manutencao/progresso.json
}
progresso 1 0 5 "Preparando a atualização"
touch deploy/manutencao/ATIVA
inicio_fora=$(date +%s)
trap 'rm -f deploy/manutencao/ATIVA deploy/manutencao/progresso.json deploy/manutencao/progresso.json.tmp' EXIT
verde "» Tela de manutenção ligada."
docker compose up -d --no-deps --force-recreate caddy

# 5. Atualização: cópia do banco antes de mexer (permite voltar para a versão anterior)
backup_dir="$(cd .. && pwd)/resolve-backups"
if [ -f .instalado ] && docker compose ps --status running postgres 2>/dev/null | grep -q postgres; then
  progresso 2 5 15 "Fazendo uma cópia de segurança do banco" 60
  mkdir -p "$backup_dir"
  arquivo="$backup_dir/antes-da-atualizacao-$(date +%F_%H%M).dump"
  verde "» Fazendo cópia do banco antes de atualizar: $arquivo"
  docker compose exec -T postgres pg_dump -U resolve -Fc resolve > "$arquivo" || { rm -f "$arquivo"; erro "Não consegui copiar o banco. A atualização foi cancelada e nada foi alterado."; }
  ls -1t "$backup_dir"/antes-da-atualizacao-*.dump 2>/dev/null | tail -n +11 | xargs -r rm -f  # guarda as 10 últimas
  # confere que a cópia abre, protege a leitura e anota qual é desta atualização (e o código de antes do git pull):
  # o deploy/voltar-versao.sh usa exatamente estes, e não "a mais nova que achar" (auditoria INF-05)
  chmod 600 "$arquivo"
  docker compose exec -T postgres pg_restore -l < "$arquivo" >/dev/null || erro "A cópia $arquivo não abre. A atualização foi cancelada e nada foi alterado."
  commit_novo=$(git rev-parse HEAD 2>/dev/null || true)
  commit_anterior=$(git rev-parse ORIG_HEAD 2>/dev/null || true)
  [ "$commit_anterior" != "$commit_novo" ] || commit_anterior=""
  printf 'resolve=%s\ncommit_anterior=%s\ncommit_novo=%s\n' "$arquivo" "$commit_anterior" "$commit_novo" > .dump-da-atualizacao
  chmod 600 .dump-da-atualizacao
fi

# 6. Compila (só na primeira instalação: na atualização já foi feito com o sistema no ar) e sobe
if [ "$compilado" = 0 ]; then
  verde "» Compilando a versão nova. A primeira vez demora alguns minutos…"
  estimativa=$(cat .duracao-compilacao 2>/dev/null || echo 600)
  case "$estimativa" in ''|*[!0-9]*) estimativa=600;; esac
  progresso 3 15 75 "Compilando a versão nova" "$estimativa"
  compilar
fi

verde "» Iniciando os serviços…"
progresso 4 75 82 "Iniciando os serviços" 30
docker compose up -d
# O backup diário grava em ./backups. Se a pasta do projeto mudar de lugar (ou for trocada por outra cópia), um
# contêiner antigo continuaria gravando na pasta velha. Recriado aqui a cada execução, ele grava na pasta atual e já faz uma cópia.
docker compose up -d --no-deps --force-recreate backup

# 6b. Garante que a senha do banco é a mesma do .env. Se não for, a API fica presa em
# "Authentication failed". Testar por 127.0.0.1 não adianta (o Postgres do Docker não pede senha ali):
# a senha do .env é sempre gravada no banco pela conexão local do contêiner; regravar a mesma senha não
# muda nada e nenhum dado é alterado.
for i in $(seq 1 30); do docker compose exec -T postgres pg_isready -U resolve -d resolve >/dev/null 2>&1 && break; sleep 2; done
if echo "ALTER USER resolve WITH PASSWORD :'senha';" | docker compose exec -T postgres sh -c 'psql -U resolve -d resolve -v ON_ERROR_STOP=1 -v senha="$POSTGRES_PASSWORD"' >/dev/null 2>&1; then
  verde "» Senha do banco conferida com o .env."
  docker compose restart api >/dev/null
else
  aviso "Não consegui conferir a senha do banco; veja o log da API abaixo se ela não subir."
fi

# 7. Espera a API responder
verde "» Aguardando a API ficar pronta…"
progresso 5 82 92 "Aplicando as mudanças no banco e iniciando o sistema" 60
for i in $(seq 1 90); do
  if docker compose exec -T api node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    pronto=1; break
  fi
  sleep 5
done
[ "${pronto:-}" = 1 ] || { docker compose logs --tail 50 api; erro "A API não respondeu. Veja o log acima e mande para o suporte."; }

# 8. Primeira instalação: a API já criou sozinha as categorias, os perfis e o primeiro setor.
#    Falta o primeiro administrador, criado pela linha de comando (a senha temporária aparece uma vez só).
progresso 6 92 99 "Concluindo os últimos ajustes" 30
primeira=0
[ -f .instalado ] || { primeira=1; date -Iseconds > .instalado; }

progresso 6 100 100 "Pronto! O sistema está voltando"
sleep 3
rm -f deploy/manutencao/ATIVA deploy/manutencao/progresso.json
verde "» Tela de manutenção desligada."
fora=$(( $(date +%s) - inicio_fora )); total=$(( $(date +%s) - inicio_total ))
echo "$(date -Iseconds) total=${total}s compilacao=${duracao_compilacao:-0}s fora_do_ar=${fora}s" >> .duracao-atualizacoes
verde "» Tempo total: $(( total / 60 )) min $(( total % 60 )) s. Sistema fora do ar: $(( fora / 60 )) min $(( fora % 60 )) s."

# imagens antigas de cada atualização ocupam 1 a 2 GB; o cache de pacotes usado nos últimos 30 dias fica
docker image prune -f >/dev/null 2>&1 || true
docker builder prune -f --filter until=720h >/dev/null 2>&1 || true

# situação do backup diário (o contêiner recriado acima já começou uma cópia nova)
if [ -f backups/ULTIMA_FALHA ] && [ backups/ULTIMA_FALHA -nt backups/ULTIMO_OK ]; then
  aviso "A última cópia de segurança diária FALHOU ($(cat backups/ULTIMA_FALHA)). Veja o motivo com: docker compose logs --tail 30 backup"
elif [ -f backups/ULTIMO_OK ]; then
  verde "» Última cópia de segurança diária conferida: $(cat backups/ULTIMO_OK) (a de hoje está sendo feita agora)."
else
  echo "  A primeira cópia de segurança diária está sendo feita agora. Confira depois com: cat $(pwd)/backups/ULTIMO_OK"
fi

url=$(grep '^PUBLIC_URL=' .env | cut -d= -f2-)
if [ "$primeira" = 1 ]; then
  echo
  verde "» Criando o primeiro administrador"
  read -rp "Usuário de acesso (ex.: maria.silva): " adm_usuario
  read -rp "Nome completo: " adm_nome
  read -rp "E-mail (para recuperar a senha; pode deixar em branco): " adm_email
  if [ -n "$adm_usuario" ] && [ -n "$adm_nome" ]; then
    docker compose exec -T api node dist/scripts/criar-usuario.js --usuario "$adm_usuario" --nome "$adm_nome" ${adm_email:+--email "$adm_email"} \
      || aviso "Não consegui criar o administrador. Rode depois o comando abaixo."
  else
    aviso "Administrador não criado agora."
  fi
  echo "  Para criar (ou recuperar) um administrador a qualquer momento:"
  echo "    docker compose exec api node dist/scripts/criar-usuario.js --usuario LOGIN --nome \"Nome Completo\""
fi
echo
verde "✔ NITERA Resolve no ar: ${url}"
echo "  No primeiro acesso o sistema pede para trocar a senha temporária e ativar a verificação em duas etapas (Minha conta)."
echo
echo "  Ver serviços:   docker compose ps"
echo "  Ver erros:      docker compose logs -f api web"
echo "  Atualizar:      git pull && sudo bash deploy/instalar.sh"
