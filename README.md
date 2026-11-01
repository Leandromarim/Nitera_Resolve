# NITERA Resolve

Central de chamados para as equipes de **TI**, **Infraestrutura de TI**, **Manutenção** e **Comunicação**.
Quem precisa de ajuda abre o chamado pelo site, pelo WhatsApp ou por e-mail e acompanha cada passo. A equipe atende
pela central de atendimento, com prazos (SLA), quadro, relatórios e painel para TV. Roda num servidor próprio, com contas próprias.

- **Abertura**: site, WhatsApp (escolhe a área e a categoria pela lista) e e-mail; anexos, ramal e local.
- **Central de atendimento**: quadro e lista, contadores de abertos, sem responsável, atrasados e críticos, som de chamado novo
  e a aba que junta a fila da equipe com as equipes acompanhadas (por exemplo, "TI + Infraestrutura"), só para leitura.
- **Prazos**: SLA por categoria e prioridade, prorrogação com justificativa e evidências, encaminhamento automático por palavras.
- **Relatórios** por equipe, categoria, canal e técnico, com exportação para planilha.
- **Painel**: categorias e SLA, usuários, perfis e setores (importa a planilha do GLPI), instituição e aparência,
  mensagens automáticas, versões e novidades, armazenamento, histórico de alterações e auditoria.

Arquitetura e segurança: [docs/ARQUITETURA.md](docs/ARQUITETURA.md). Implantação detalhada, WhatsApp e e-mail:
[docs/IMPLANTACAO.md](docs/IMPLANTACAO.md). Histórico: [CHANGELOG.md](CHANGELOG.md).

## Requisitos do servidor

- Ubuntu 22.04 ou 24.04 (servidor local, VPS ou nuvem), com acesso de administrador (`sudo`).
- 2 GB de RAM no mínimo (4 GB recomendado; com menos de 4 GB o instalador cria memória de troca sozinho).
- 20 GB de disco livres, mais o espaço dos anexos e dos backups.
- Portas 80 e 443 liberadas. Para HTTPS automático, um domínio (ex.: `chamados.suainstituicao.com.br`)
  apontando para o IP do servidor. Sem domínio, o sistema funciona por `http://IP` na rede interna.

## Instalação

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/Leandromarim/Nitera_Resolve.git nitera-resolve
cd nitera-resolve
sudo bash deploy/instalar.sh
```

O instalador:
1. pergunta o domínio e o nome da instituição;
2. cria o `.env` com senhas e chaves geradas na hora;
3. compila e sobe PostgreSQL, API, site, Caddy e backup;
4. pede o usuário, o nome e o e-mail do primeiro administrador e mostra a **senha temporária uma única vez**.

Na primeira vez, a própria API cria as categorias, os perfis e o primeiro setor.

Entre no endereço mostrado, troque a senha e ative a verificação em duas etapas em **Meu perfil**.

## Atualização

```bash
cd nitera-resolve
git pull && sudo bash deploy/instalar.sh
```

A versão nova é compilada com o sistema no ar. A tela de manutenção aparece só durante a cópia do banco e a troca dos serviços.

## Licença

Software proprietário. Veja [LICENSE](LICENSE).
