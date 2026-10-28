import { describe, expect, it } from "vitest";
import { montarItens, prazoPadrao } from "@/lib/ata-types";

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
});
