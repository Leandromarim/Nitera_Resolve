#!/usr/bin/env bash
# Volta o NITERA Resolve para a versão anterior à última atualização (auditoria INF-05).
# Usa o código de antes do "git pull" e a cópia do banco feita pelo instalador antes de atualizar,
# os dois anotados em .dump-da-atualizacao. O banco de agora NÃO é apagado: fica guardado com outro nome.
# Uso, dentro da pasta do projeto:  sudo bash deploy/voltar-versao.sh
set -euo pipefail

cd "$(dirname "$0")/.."
verde() { printf '\033[1;32m%s\033[0m\n' "$*"; }
aviso() { printf '\033[1;33m%s\033[0m\n' "$*"; }
erro() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || erro "Rode como administrador: sudo bash deploy/voltar-versao.sh"
[ -f .dump-da-atualizacao ] || erro "Não encontrei .dump-da-atualizacao: a última atualização não anotou a cópia do banco. Nada foi alterado."
backups="$(cd .. && pwd)/resolve-backups"
dump=$(sed -n 's/^resolve=//p' .dump-da-atualizacao)
commit=$(sed -n 's/^commit_anterior=//p' .dump-da-atualizacao)
[ -n "$dump" ] && [ -f "$dump" ] || erro "A cópia do banco desta atualização (${dump:-sem nome}) não existe mais. Nada foi alterado."
if [ -n "$commit" ]; then git cat-file -e "$commit^{commit}" 2>/dev/null || erro "O código anterior ($commit) não está nesta pasta. Nada foi alterado."; fi

echo
aviso "Isto vai:"
if [ -n "$commit" ]; then
  echo "  1. voltar o código para a versão de antes da atualização ($(git log -1 --format='%h %s' "$commit"))"
else
  echo "  1. manter o código como está (a atualização não trocou o código)"
fi
echo "  2. devolver o banco ao estado de antes da atualização"
echo "     cópia usada: $dump ($(date -r "$dump" '+%d/%m/%Y %H:%M'))"
echo "     O banco de agora NÃO é apagado: fica guardado com outro nome, e também é copiado antes."
aviso "     Tudo o que foi registrado depois da atualização (chamados, respostas, cadastros) deixa de aparecer."
echo
read -rp "Digite VOLTAR para confirmar: " ok
[ "$ok" = "VOLTAR" ] || erro "Cancelado. Nada foi alterado."

docker compose up -d postgres
for i in $(seq 1 60); do docker compose exec -T postgres pg_isready -U resolve >/dev/null 2>&1 && break; sleep 2; done
docker compose exec -T postgres pg_restore -l < "$dump" >/dev/null || erro "A cópia $dump não abre. Nada foi alterado."

verde "» Parando o sistema…"
docker compose stop api web >/dev/null 2>&1 || true

# Devolve o banco sem apagar nada: copia o de agora, restaura a cópia antiga num banco novo e, só se tudo deu
# certo, troca os nomes. O banco de agora fica guardado como resolve_antes_de_voltar_<data>.
psqlc() { docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U resolve -d postgres -tAc "$1"; }
quando=$(date +%Y%m%d_%H%M%S)
novo="resolve_volta_${quando}"
guardado="resolve_antes_de_voltar_${quando}"
mkdir -p "$backups"
verde "» Copiando o banco de agora antes de voltar…"
docker compose exec -T postgres pg_dump -U resolve -Fc resolve > "$backups/antes-de-voltar-resolve-$quando.dump" \
  || { docker compose up -d >/dev/null; erro "Não consegui copiar o banco de agora. Ele não foi mexido."; }
chmod 600 "$backups/antes-de-voltar-resolve-$quando.dump"
verde "» Devolvendo o banco ao estado de antes da atualização…"
psqlc "CREATE DATABASE \"$novo\" OWNER resolve;" >/dev/null
if ! docker compose exec -T postgres pg_restore -U resolve -d "$novo" --no-owner --exit-on-error < "$dump"; then
  psqlc "DROP DATABASE IF EXISTS \"$novo\";" >/dev/null || true
  docker compose up -d >/dev/null
  erro "A restauração do banco falhou. O banco de agora continua como estava."
fi
psqlc "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('resolve', '$novo') AND pid <> pg_backend_pid();" >/dev/null
psqlc "ALTER DATABASE resolve RENAME TO \"$guardado\";" >/dev/null
psqlc "ALTER DATABASE \"$novo\" RENAME TO resolve;" >/dev/null
echo "  O banco de antes de voltar ficou guardado como $guardado."

if [ -n "$commit" ]; then
  verde "» Voltando o código…"
  git checkout --detach "$commit"
fi
rm -f deploy/manutencao/ATIVA deploy/manutencao/progresso.json
verde "» Ligando a versão anterior (pode demorar alguns minutos para compilar)…"
docker compose up -d --build
docker compose up -d --no-deps --force-recreate backup
verde "✔ Pronto: a versão anterior está no ar."
[ -z "$commit" ] || echo "  Para atualizar de novo depois da correção: git checkout main && git pull && sudo bash deploy/instalar.sh"
