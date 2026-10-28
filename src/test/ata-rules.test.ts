import { describe, expect, it } from "vitest";
import { montarItens, padronizarSiglas, prazoPadrao } from "@/lib/ata-types";

describe("regras da ata", () => {
  it("prazo padrão é uma semana após a reunião", () => {
    expect(prazoPadrao("2026-10-28")).toBe("04/11/2026");
  });

  it("adiciona Abertura (1) e Encerramento ao final", () => {
    const r = montarItens([{ numero: "2", assunto: "X", acao: "Tópico", prazo: null, responsavel: null }]);
    expect(r[0]?.assunto).toBe("Abertura - Opening");
    expect(r[1]?.numero).toBe("2");
    expect(r[2]).toMatchObject({ numero: "3", assunto: "Encerramento - Closing" });
    expect(r[3]?.numero).toBe("3.1");
  });

  it("deixa as siglas da empresa em maiúsculas", () => {
    expect(padronizarSiglas("cfti, orca, fga, grupo sada, hs-negócios, vt-sa e vt-de")).toBe("CFTI, ORCA, FGA, grupo SADA, HS-negócios, VT-SA e VT-DE");
    expect(padronizarSiglas("hoje a orcamento")).toBe("hoje a orcamento");
  });
});

import { renumerar, tituloCase } from "@/lib/ata-types";
describe("ajustes", () => {
  it("títulos com inicial maiúscula", () => {
    expect(tituloCase("pedido de compra da unidade #71")).toBe("Pedido de Compra da Unidade #71");
  });
  it("equipamentos capitalizados", () => {
    expect(padronizarSiglas("o ring dryer e o tube bundle dryer")).toBe("o Ring Dryer e o Tube Bundle Dryer");
  });
  it("renumera após inserir linha", () => {
    const r = renumerar([
      { numero: "1", assunto: "A", acao: "Tópico", prazo: "N/A", responsavel: "x" },
      { numero: "1.1", assunto: "b", acao: "Informativo", prazo: "N/A", responsavel: "x" },
      { numero: "1.1", assunto: "c", acao: "Informativo", prazo: "N/A", responsavel: "x" },
      { numero: "9", assunto: "D", acao: "Tópico", prazo: "N/A", responsavel: "x" },
    ]);
    expect(r.map((i) => i.numero)).toEqual(["1", "1.1", "1.2", "2"]);
  });
});
