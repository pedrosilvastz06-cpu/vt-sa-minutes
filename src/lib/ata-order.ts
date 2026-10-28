import type { AtaItem } from "./ata-types";

export type ItemComOrigem = AtaItem & { linhaOrigem: number };

/** Source positions, not deadlines or topic names, define the meeting sequence. */
export function ordenarPelaOrigem(itens: ItemComOrigem[], totalLinhas: number): AtaItem[] {
  const entradas: { item: ItemComOrigem; topico: ItemComOrigem; ordem: number }[] = [];
  let topico: ItemComOrigem | undefined;
  for (const [ordem, item] of itens.entries()) {
    if (!Number.isInteger(item.linhaOrigem) || item.linhaOrigem < 1 || item.linhaOrigem > totalLinhas) {
      throw new Error("A IA não identificou a sequência das anotações. Gere a ata novamente.");
    }
    if (item.acao === "Tópico") {
      topico = item;
    } else {
      if (!topico) throw new Error("A IA retornou um registro sem tópico. Gere a ata novamente.");
      entradas.push({ item, topico, ordem });
    }
  }
  entradas.sort((a, b) => a.item.linhaOrigem - b.item.linhaOrigem || a.ordem - b.ordem);

  const saida: AtaItem[] = [];
  let anterior: ItemComOrigem | undefined;
  let numeroTopico = 1;
  let contadores: number[] = [];
  for (const entrada of entradas) {
    if (entrada.topico !== anterior) {
      numeroTopico += 1;
      const { linhaOrigem: _origem, ...titulo } = entrada.topico;
      saida.push({ ...titulo, numero: String(numeroTopico) });
      anterior = entrada.topico;
      contadores = [];
    }
    const profundidade = Math.max(1, entrada.item.numero.split(".").length - 1);
    const nivelExistente = contadores.length >= profundidade;
    contadores = contadores.slice(0, profundidade);
    while (contadores.length < profundidade) contadores.push(1);
    if (nivelExistente) {
      contadores[profundidade - 1] = (contadores[profundidade - 1] ?? 0) + 1;
    }
    const { linhaOrigem: _origem, ...registro } = entrada.item;
    saida.push({ ...registro, numero: [numeroTopico, ...contadores].join(".") });
  }
  return saida;
}

export function textoNaOrdem(itens: AtaItem[]): string {
  return itens.map((item) => item.acao === "Tópico"
    ? `\n${item.assunto.split(" - ")[0] ?? item.assunto}`
    : item.assunto.split("\n")[0] ?? item.assunto).join("\n").trim();
}