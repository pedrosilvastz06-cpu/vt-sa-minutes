import { describe, expect, it } from "vitest";
import { ordenarPelaOrigem, textoNaOrdem, type ItemComOrigem } from "@/lib/ata-order";

const topico = (numero: string, assunto: string, linhaOrigem: number): ItemComOrigem =>
  ({ numero, assunto, linhaOrigem, acao: "Tópico", prazo: "N/A", responsavel: "Todos - All" });
const fato = (numero: string, assunto: string, linhaOrigem: number): ItemComOrigem =>
  ({ numero, assunto, linhaOrigem, acao: "Informativo", prazo: "N/A", responsavel: "Paul" });

describe("ordem cronológica anotada", () => {
  it("restaura A, B, A quando a IA agrupa a retomada de A", () => {
    const itens = ordenarPelaOrigem([
      topico("2", "Pedido - Order", 1), fato("2.1", "Pedido inicial\nInitial order", 1),
      fato("2.2", "Retomada do pedido\nOrder resumed", 3),
      topico("3", "Desenho - Drawing", 2), fato("3.1", "Desenho aprovado\nDrawing approved", 2),
    ], 3);
    expect(itens.filter(i => i.acao !== "Tópico").map(i => i.assunto)).toEqual([
      "Pedido inicial\nInitial order", "Desenho aprovado\nDrawing approved", "Retomada do pedido\nOrder resumed",
    ]);
    expect(itens.map(i => i.numero)).toEqual(["2", "2.1", "3", "3.1", "4", "4.1"]);
    expect(itens.filter(i => i.acao === "Tópico").map(i => i.assunto)).toEqual(["Pedido - Order", "Desenho - Drawing", "Pedido - Order"]);
    expect(textoNaOrdem(itens)).toBe("Pedido\nPedido inicial\n\nDesenho\nDesenho aprovado\n\nPedido\nRetomada do pedido");
  });
  it("mantém a ordem da mesma linha e não ordena pelos prazos", () => {
    const itens = ordenarPelaOrigem([topico("2", "Tarefas", 1),
      { ...fato("2.1", "Primeiro", 1), acao: "Tarefa Pendente", prazo: "30/11/2026" },
      { ...fato("2.2", "Segundo", 1), acao: "Tarefa Pendente", prazo: "29/10/2026" },
    ], 1);
    expect(itens.slice(1).map(i => i.assunto)).toEqual(["Primeiro", "Segundo"]);
  });
  it("recusa uma origem inexistente em vez de apresentar uma ordem inventada", () => {
    expect(() => ordenarPelaOrigem([topico("2", "Pedido", 1), fato("2.1", "Fato", 9)], 3)).toThrow();
  });
});