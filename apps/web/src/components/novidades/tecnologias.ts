import { Boxes, Database, HardDrive, LayoutTemplate, Lock, Plug, Server, FileText, Wrench, type LucideIcon } from 'lucide-react';

/**
 * Tecnologias usadas no sistema (seção "Tecnologias da Intranet").
 *
 * As versões NÃO são digitadas aqui: as do portal vêm do build (next.config.ts) e as do servidor,
 * do Node.js e do PostgreSQL vêm de GET /api/novidades/tecnologias. Assim cada atualização mostra
 * sozinha a versão nova. Biblioteca nova que não estiver nesta lista aparece em "Outras bibliotecas".
 */
export interface Tech {
  name: string;
  /** pacote cuja versão é exibida (e que deixa de aparecer em "Outras bibliotecas") */
  pkg?: string;
  /** outros pacotes que fazem parte desta mesma tecnologia */
  also?: string[];
  /** versão que não vem de pacote */
  runtime?: 'node' | 'postgres';
  /** para que serve */
  description: string;
  /** por que é importante para a intranet */
  importance: string;
  /** recurso que o NITERA Resolve não usa (fica fora da lista) */
  soIntranet?: boolean;
}
export interface TechGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  items: Tech[];
}

export const TECNOLOGIAS: TechGroup[] = [
  {
    id: 'interface',
    title: 'Interface (front-end)',
    icon: LayoutTemplate,
    items: [
      { name: 'Next.js', pkg: 'next', description: 'Estrutura das páginas do portal e do painel.', importance: 'Deixa a navegação rápida e organiza centenas de telas num só projeto, fácil de atualizar.' },
      { name: 'React', pkg: 'react', also: ['react-dom'], description: 'Monta as telas e os componentes interativos.', importance: 'É o padrão do mercado: as telas respondem na hora a cada clique sem recarregar a página.' },
      { name: 'TypeScript', pkg: 'typescript', description: 'JavaScript com tipos, no portal e no servidor.', importance: 'Acusa erros antes de o sistema ir para o ar, o que reduz falhas nas atualizações.' },
      { name: 'Tailwind CSS', pkg: 'tailwindcss', also: ['@tailwindcss/postcss', 'postcss'], description: 'Visual das telas, do celular ao computador, com tema claro e escuro.', importance: 'Mantém o mesmo padrão visual em todas as telas e permite trocar as cores da instituição pelo painel.' },
      { name: 'Lucide', pkg: 'lucide-react', description: 'Ícones de menus, botões e atalhos.', importance: 'Ícones claros ajudam quem usa a intranet a achar as coisas mais rápido.' },
      { name: 'Tiptap', pkg: '@tiptap/react', also: ['@tiptap/starter-kit', '@tiptap/extension-image', '@tiptap/extension-link'], description: 'Editor de texto do painel (páginas, jornal, novidades).', importance: 'Permite que Comunicação, RH e Qualidade publiquem conteúdo formatado sem depender da TI.' },
      { name: 'Recharts', pkg: 'recharts', description: 'Gráficos dos indicadores, avaliações e relatórios.', importance: 'Transforma números em gráficos fáceis de ler para a gestão.' },
      { name: 'Socket.IO (navegador)', pkg: 'socket.io-client', description: 'Recebe mensagens do chat e avisos em tempo real.', importance: 'Mensagens e chamados chegam na hora, sem precisar atualizar a página.' },
      { name: 'Fonte Inter', pkg: '@fontsource-variable/inter', description: 'Tipografia da intranet.', importance: 'Fonte feita para leitura em tela, instalada junto com o sistema (não depende de serviço externo).' },
      { name: 'clsx', pkg: 'clsx', description: 'Combina estilos conforme o estado de cada tela.', importance: 'Deixa o código das telas mais simples e com menos erros visuais.' },
    ],
  },
  {
    id: 'servidor',
    title: 'Servidor (back-end/API)',
    icon: Server,
    items: [
      { name: 'Node.js', runtime: 'node', description: 'Ambiente que executa o servidor da intranet.', importance: 'Rápido e com suporte de longo prazo, recebe correções de segurança por anos.' },
      { name: 'NestJS', pkg: '@nestjs/core', also: ['@nestjs/common', '@nestjs/platform-express', '@nestjs/config', '@nestjs/websockets', '@nestjs/platform-socket.io', 'reflect-metadata', 'rxjs'], description: 'Estrutura da API: rotas, permissões e regras de cada módulo.', importance: 'Organiza cada área (chamados, usuários, relatórios…) em módulos separados, o que facilita crescer sem quebrar o que já funciona.' },
      { name: 'Prisma ORM', pkg: '@prisma/client', also: ['prisma'], description: 'Acesso ao banco de dados e às mudanças de estrutura (migrações).', importance: 'Cada atualização ajusta o banco sozinha e de forma segura, sem comandos manuais.' },
      { name: 'Socket.IO (servidor)', pkg: 'socket.io', description: 'Envia mensagens do chat e avisos em tempo real.', importance: 'É o que faz o chat funcionar como o WhatsApp.' },
      { name: 'class-validator', pkg: 'class-validator', also: ['class-transformer'], description: 'Confere todos os dados enviados antes de gravar.', importance: 'Impede que dados errados ou maliciosos entrem no banco.' },
      { name: 'Helmet', pkg: 'helmet', description: 'Cabeçalhos de segurança do servidor.', importance: 'Protege o navegador contra ataques comuns da internet.' },
      { name: 'Limite de requisições', pkg: '@nestjs/throttler', description: 'Limita o número de pedidos por pessoa.', importance: 'Barra tentativas de adivinhar senhas e uso abusivo.' },
      { name: 'Tarefas agendadas', pkg: '@nestjs/schedule', description: 'Lembretes, prazos de chamados e leitura de e-mails.', importance: 'Faz o trabalho repetitivo sozinho, no horário certo.' },
      { name: 'cookie-parser', pkg: 'cookie-parser', description: 'Lê o cookie seguro da sessão.', importance: 'Mantém o login sem expor a sessão a scripts.' },
      { name: 'UUID', pkg: 'uuid', description: 'Gera identificadores únicos.', importance: 'Evita que alguém adivinhe o endereço de um arquivo ou registro.' },
    ],
  },
  {
    id: 'banco',
    title: 'Banco de dados',
    icon: Database,
    items: [{ name: 'PostgreSQL', runtime: 'postgres', description: 'Banco de dados onde ficam todas as informações da intranet.', importance: 'Banco robusto e gratuito, usado por empresais e bancos; garante que nada se perca mesmo com muitos acessos ao mesmo tempo.' }],
  },
  {
    id: 'seguranca',
    title: 'Segurança e acesso',
    icon: Lock,
    items: [
      { name: 'Argon2id', pkg: 'argon2', description: 'Guarda as senhas cifradas.', importance: 'Nem a TI consegue ler as senhas; se o banco vazar, elas continuam protegidas.' },
      { name: 'JWT com renovação por cookie HttpOnly', pkg: '@nestjs/jwt', description: 'Mantém o login ativo com segurança.', importance: 'A sessão expira e se renova sozinha, sem ficar exposta.' },
      { name: 'Verificação em duas etapas (TOTP)', pkg: 'otplib', description: 'Código do aplicativo autenticador no login.', importance: 'Mesmo com a senha descoberta, ninguém entra sem o celular da pessoa.' },
      { name: 'Perfis de acesso (RBAC)', description: 'Cada pessoa vê e altera só o que o seu perfil permite.', importance: 'Protege informações sensíveis, como os dados dos chamados (LGPD).' },
      { name: 'Auditoria e histórico de versões', description: 'Registra quem alterou o quê e quando, com volta à versão anterior.', importance: 'Dá rastreabilidade e permite desfazer qualquer mudança do painel.' },
      { name: 'URLs assinadas', description: 'Arquivos privados só abrem por links temporários.', importance: 'Um link copiado não serve para outra pessoa nem depois de expirar.' },
      { name: 'HTTPS automático', description: 'Toda a comunicação é criptografada.', importance: 'Ninguém na rede consegue ler senhas ou mensagens.' },
    ],
  },
  {
    id: 'documentos',
    title: 'Documentos e arquivos',
    icon: FileText,
    items: [
      { name: 'PDFKit', pkg: 'pdfkit', description: 'Gera PDFs (relatórios).', importance: 'Documentos saem prontos para imprimir, com a identidade da instituição.' },
      { name: 'ExcelJS', pkg: 'exceljs', description: 'Gera e lê planilhas .xlsx.', importance: 'Relatórios saem direto em Excel, prontos para a gestão analisar.' },
      { soIntranet: true, name: 'CFB', pkg: 'cfb', description: 'Abre planilhas no formato antigo do Excel (.xls).', importance: 'Listas antigas de colaboradores e médicos entram sem precisar converter para .xlsx.' },
      { soIntranet: true, name: 'PDF.js', pkg: 'pdfjs-dist', description: 'Lê o texto de PDFs (da Mozilla, a mesma do Firefox).', importance: 'Listas de colaboradores e médicos exportadas em PDF por outros sistemas podem ser importadas.' },
      { name: 'QRCode', pkg: 'qrcode', description: 'Cria o QR Code do WhatsApp do suporte.', importance: 'Quem está no computador abre a conversa com o suporte só apontando o celular.' },
      { name: 'Sharp', pkg: 'sharp', description: 'Ajusta imagens e aplica a marca d’água.', importance: 'Imagens ficam leves para carregar rápido e documentos ficam identificados.' },
      { name: 'Poppler', description: 'Converte PDF em imagens para a visualização protegida.', importance: 'Permite ler documentos controlados sem baixar o arquivo original.' },
      { name: 'file-type', pkg: 'file-type', description: 'Confere o tipo real de cada arquivo enviado.', importance: 'Bloqueia vírus disfarçados de imagem ou PDF.' },
    ],
  },
  {
    id: 'integracoes',
    title: 'Integrações',
    icon: Plug,
    items: [
      { name: 'Nodemailer, ImapFlow e Mailparser', pkg: 'nodemailer', also: ['imapflow', 'mailparser'], description: 'Envia e lê e-mails dos chamados.', importance: 'Quem não está na intranet também abre e acompanha chamados por e-mail.' },
      { name: 'API do WhatsApp (Meta)', description: 'Abrir e acompanhar chamados pelo WhatsApp.', importance: 'Atende a equipe pelo canal que todos já usam no dia a dia.' },
      { soIntranet: true, name: 'YouTube', description: 'Vídeos dos treinamentos.', importance: 'Vídeos sem pesar o servidor do hospital.' },
    ],
  },
  {
    id: 'infraestrutura',
    title: 'Infraestrutura',
    icon: HardDrive,
    items: [
      { name: 'Docker e Docker Compose', description: 'Empacotam a intranet para instalar e atualizar sempre do mesmo jeito.', importance: 'A atualização é um comando só, e dá para voltar atrás se algo der errado.' },
      { name: 'Caddy 2', description: 'Servidor web com certificado HTTPS automático.', importance: 'Renova o certificado sozinho e mostra a tela de manutenção durante as atualizações.' },
      { name: 'AWS Lightsail (Ubuntu)', description: 'Servidor na nuvem que hospeda a intranet.', importance: 'Disponível 24 horas, de dentro e de fora da instituição.' },
      { name: 'Backup diário e cópia antes de cada atualização', description: 'Cópia do banco de dados e dos arquivos.', importance: 'Nenhuma informação se perde, mesmo em caso de falha.' },
    ],
  },
  {
    id: 'desenvolvimento',
    title: 'Desenvolvimento e qualidade',
    icon: Wrench,
    items: [
      { name: 'pnpm (monorepo)', description: 'Organiza o portal e a API num só projeto.', importance: 'Dependências controladas: o que roda no servidor é exatamente o que foi testado.' },
      { name: 'Git e GitHub', description: 'Controle de versão do código.', importance: 'Cada mudança fica registrada e pode ser revista ou desfeita.' },
      { name: 'Jest e Supertest', description: 'Testes automatizados das regras e da API.', importance: 'Conferem as regras antes de cada versão ir para o ar.' },
      { name: 'Playwright', description: 'Testes no navegador, simulando o uso real.', importance: 'Garante que as telas funcionam como o colaborador vai usar.' },
    ],
  },
];

/** Grupo extra montado sozinho com as bibliotecas que não estão na lista acima. */
export const OUTRAS = { id: 'outras', title: 'Outras bibliotecas', icon: Boxes };

/** Pacotes que não precisam aparecer em "Outras bibliotecas" (ferramentas internas do build). */
export const IGNORAR = new Set(['@nestjs/cli', '@nestjs/schematics', '@nestjs/testing', 'jest', 'ts-jest', 'ts-node', 'supertest', 'eslint']);

/** Crédito de desenvolvimento exibido no fim da seção "Tecnologias da Intranet". */
export const DESENVOLVIDO_POR = {
  empresa: 'NITERA Tecnologia',
  logo: '/nitera-logo.png',
  logoClaro: '/nitera-logo-claro.png',
};
