import { BadRequestException, ValidationError } from '@nestjs/common';

/** Mensagens padrão do class-validator (em inglês) trocadas pelo motivo em português, pela regra que falhou. */
const REGRA_PT: Record<string, string> = {
  whitelistValidation: 'campo não permitido',
  isDefined: 'preencha este campo',
  isNotEmpty: 'preencha este campo',
  isString: 'precisa ser um texto',
  isInt: 'precisa ser um número inteiro',
  isNumber: 'precisa ser um número',
  isBoolean: 'precisa ser sim ou não',
  isEmail: 'e-mail em formato inválido (ex.: maria@instituicao.com.br)',
  isUUID: 'escolha uma opção da lista',
  isIn: 'escolha uma opção da lista',
  isEnum: 'escolha uma opção da lista',
  isArray: 'lista inválida',
  arrayMaxSize: 'itens demais',
  arrayMinSize: 'escolha ao menos um item',
  minLength: 'texto curto demais',
  maxLength: 'texto longo demais',
  min: 'valor baixo demais',
  max: 'valor alto demais',
  matches: 'formato inválido',
  isDateString: 'data inválida',
  isISO8601: 'data inválida',
  isUrl: 'endereço (link) inválido',
  isHexColor: 'cor inválida',
};

export interface CampoErro {
  /** caminho do campo no corpo enviado, ex.: "pacienteNome" ou "itens.0.rotulo" */
  campo: string;
  mensagens: string[];
}

/** Mensagem própria do DTO fica como está; a padrão em inglês ("x must be...") vira o motivo em português. */
function traduz(regra: string, msg: string, campo: string) {
  const padrao = msg.startsWith(campo) || msg.startsWith(`property ${campo}`) || /^(each value in )?[a-zA-Z.\d]+ (must|should|has)/.test(msg);
  return padrao ? (REGRA_PT[regra] ?? 'valor inválido') : msg;
}

function achata(erros: ValidationError[], prefixo = ''): CampoErro[] {
  const out: CampoErro[] = [];
  for (const e of erros) {
    const campo = prefixo ? `${prefixo}.${e.property}` : e.property;
    if (e.constraints) out.push({ campo, mensagens: Object.entries(e.constraints).map(([regra, msg]) => traduz(regra, msg, e.property)) });
    if (e.children?.length) out.push(...achata(e.children, campo));
  }
  return out;
}

/**
 * Erro de validação com o campo exato de cada problema, para o site apontar e destacar o campo certo.
 * `message` continua a lista de textos (compatível com as telas antigas); `campos` traz campo + motivos.
 */
export function erroDeValidacao(erros: ValidationError[]) {
  const campos = achata(erros);
  return new BadRequestException({ message: campos.flatMap((c) => c.mensagens), campos });
}
