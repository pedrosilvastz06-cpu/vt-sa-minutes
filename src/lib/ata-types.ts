export type Acao = "Tópico" | "Informativo" | "Tarefa Pendente";

export interface AtaItem {
  numero: string;
  assunto: string;
  acao: Acao;
  /** dd/mm/aaaa, "N/A" or null when a pending task has no informed deadline */
  prazo: string | null;
  /** null when unknown */
  responsavel: string | null;
}

export interface Participante {
  nome: string;
  empresa: string;
  email: string;
  visto: string;
}

export interface Cabecalho {
  cliente: string;
  projeto: string;
  local: string;
  elaboracao: string;
  data: string; // yyyy-mm-dd
  docNumero: string;
  horaInicio: string;
  horaTermino: string;
}

export const CONFIRMAR_PRAZO = "[CONFIRMAR PRAZO]";
export const CONFIRMAR_RESPONSAVEL = "[CONFIRMAR RESPONSÁVEL]";

export const ABERTURA: AtaItem = {
  numero: "1",
  assunto: "Abertura - Opening",
  acao: "Tópico",
  prazo: "N/A",
  responsavel: "Todos - All",
};

export const ENCERRAMENTO_TEXTO =
  "Não havendo mais tópicos para discussão, a reunião deu-se por encerrada.\nWith no further topics to discuss, the meeting was adjourned.";

/** Adds one week to a yyyy-mm-dd meeting date and returns dd/mm/aaaa. */
export function prazoPadrao(dataReuniao: string): string {
  const [y = 0, m = 1, d = 1] = dataReuniao.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 7));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(dt.getUTCDate())}/${p(dt.getUTCMonth() + 1)}/${dt.getUTCFullYear()}`;
}

/** Wraps AI topics with the company's fixed opening and closing, renumbering top-level topics. */
export function montarItens(corpo: AtaItem[]): AtaItem[] {
  const out: AtaItem[] = [ABERTURA];
  let topo = 1;
  let atual = "";
  for (const bruto of corpo) {
    const it = { ...bruto, assunto: padronizarSiglas(bruto.assunto), responsavel: bruto.responsavel && padronizarSiglas(bruto.responsavel) };
    const partes = it.numero.split(".");
    if (partes.length === 1) {
      topo += 1;
      atual = partes[0] ?? "";
      out.push({ ...it, assunto: padronizarSiglas(tituloCase(it.assunto)), numero: String(topo), prazo: "N/A", responsavel: "Todos - All" });
    } else {
      const resto = partes.slice(1);
      out.push({ ...it, numero: [String(topo), ...resto].join(".") });
    }
  }
  topo += 1;
  out.push({ numero: String(topo), assunto: "Encerramento - Closing", acao: "Tópico", prazo: "N/A", responsavel: "Todos - All" });
  out.push({ numero: `${topo}.1`, assunto: ENCERRAMENTO_TEXTO, acao: "Informativo", prazo: "N/A", responsavel: "Todos - All" });
  return out;
}

export function pendenciasAbertas(itens: AtaItem[]) {
  return itens.filter(
    (i) => i.acao === "Tarefa Pendente" && (!i.prazo || i.prazo === CONFIRMAR_PRAZO || !i.responsavel || i.responsavel === CONFIRMAR_RESPONSAVEL),
  );
}

/** Company/partner acronyms that must always appear in uppercase. */
export const SIGLAS_MAIUSCULAS = ["CFTI", "ORCA", "FGA", "SADA", "HS", "VT-SA", "VT-DE"];

/** Equipment names that must always be written with capitalized words. */
export const EQUIPAMENTOS = ["Tube Bundle Dryer", "Ring Dryer", "Flash Dryer", "Belt Dryer", "Rotary Dryer", "Screw Press", "Decanter", "Evaporator"];

export function padronizarSiglas(texto: string): string {
  let out = texto;
  for (const s of [...EQUIPAMENTOS, ...SIGLAS_MAIUSCULAS]) {
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "giu"), s);
  }
  return out;
}

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos", "a", "o", "as", "os", "para", "com", "por", "ao", "à", "of", "the", "and", "for", "to", "in", "on", "at", "by", "with", "or"]);

/** Title case for topic titles: "pedido de compra da unidade #71" -> "Pedido de Compra da Unidade #71". */
export function tituloCase(texto: string): string {
  return texto
    .split(/(\s+)/)
    .map((w, i) => {
      if (/^\s+$/.test(w) || !w) return w;
      if (/[A-Z].*[A-Z]|\d|#/.test(w)) return w; // acronyms, numbers
      const low = w.toLocaleLowerCase("pt-BR");
      const anterior = texto.split(/\s+/)[Math.max(0, Math.floor(i / 2) - 1)] ?? "";
      if (i > 0 && MINUSCULAS.has(low) && anterior !== "-") return low;
      return low.charAt(0).toLocaleUpperCase("pt-BR") + low.slice(1);
    })
    .join("");
}
