import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const gerarAtaFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      anotacoes: z.string().min(1).max(200000),
      transcricao: z.string().max(400000),
      participantes: z.string().max(5000),
      dataReuniao: z.string().max(20),
    }),
  )
  .handler(async ({ data }) => {
    const { gerarAta } = await import("./ata.server");
    return gerarAta(data);
  });
