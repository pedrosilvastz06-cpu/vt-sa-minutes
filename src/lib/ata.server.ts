import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./ai/run-id";

const schema = z.object({
  itens: z.array(
    z.object({
      numero: z.string(),
      assunto: z.string(),
      acao: z.enum(["Tópico", "Informativo", "Tarefa Pendente"]),
      prazo: z.string().nullable(),
      responsavel: z.string().nullable(),
    }),
  ),
  textoCorrido: z.string(),
  alertas: z.array(z.string()),
});

export type GerarResultado = z.infer<typeof schema>;

const INSTRUCOES = `Você organiza atas de reunião em português do Brasil para a equipe comercial da HS-Negócios / VetterTec Brasil (soluções industriais de secagem, desidratação mecânica e evaporação).

Transforme as anotações (fonte principal) e, se houver, a transcrição (fonte complementar) em registros de ata.

REGRAS OBRIGATÓRIAS
- NÃO inclua "Abertura" nem "Encerramento": o sistema adiciona automaticamente. Comece a numeração dos tópicos em 2.
- Ordem cronológica dos assuntos.
- Numeração hierárquica: tópico "2"; registros "2.1", "2.2"; respostas/desdobramentos "2.1.1", "2.1.2".
- Cada tópico (numero sem ponto) tem acao "Tópico", assunto curto como título, prazo "N/A", responsavel "Todos - All".
- Registros: acao "Informativo" (algo dito, informado, decidido) ou "Tarefa Pendente" (alguém se comprometeu a fazer algo).
- Informativo: prazo "N/A"; responsavel = quem falou (primeiro nome, como nas anotações).
- Tarefa Pendente: prazo no formato dd/mm/aaaa se foi informado; se NÃO foi informado, prazo null (nunca invente). responsavel = quem executará; se não estiver claro, null.
- Escreva no estilo formal da empresa, em terceira pessoa e no pretérito: "Paul informou que...", "Fábio solicitou a Paul que...", "Paul confirmou que enviará...".
- Melhore o português das anotações: corrija gramática, ortografia e pontuação, deixando o texto profissional, claro e objetivo, sem distorcer o sentido.
- Escreva sempre em MAIÚSCULAS as siglas: CFTI, ORCA, FGA, SADA, HS, VT-SA, VT-DE (ex.: "HS-Negócios", "Grupo SADA").
- Preserve exatamente nomes de pessoas, empresas, equipamentos, números de unidades (#51, #61), termos técnicos e siglas.
- Nunca invente informações, decisões, responsáveis ou prazos. Não altere o sentido. Evite repetições excessivas.
- textoCorrido: a ata em texto corrido, em parágrafos por tópico, para revisão de clareza e fidelidade.
- alertas: lista curta de informações ausentes, duvidosas ou conflitantes que o usuário deve confirmar (ex.: prazo não informado no item 3.1.1). Lista vazia se nada.`;

export async function gerarAta(input: {
  anotacoes: string;
  transcricao: string;
  participantes: string;
  dataReuniao: string;
  signal?: AbortSignal;
}): Promise<GerarResultado> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("A chave da IA não está configurada.");
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const prompt = `Data da reunião: ${input.dataReuniao || "não informada"}
Participantes: ${input.participantes || "não informados"}

=== ANOTAÇÕES (fonte principal) ===
${input.anotacoes}

=== TRANSCRIÇÃO (complementar) ===
${input.transcricao || "(sem transcrição)"}`;

  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    instructions: INSTRUCOES,
    prompt,
    abortSignal: input.signal,
    output: Output.object({ schema }),
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  } as Parameters<typeof streamText>[0]);

  try {
    return (await result.output) as GerarResultado;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) {
      throw new Error("A IA não conseguiu organizar a ata. Revise as anotações e tente novamente.");
    }
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 402) throw new Error("Os créditos de IA acabaram. Adicione créditos no seu plano para continuar.");
    if (status === 429) throw new Error("Muitas solicitações no momento. Aguarde um minuto e tente de novo.");
    if (status === 403) throw new Error("O uso de IA está bloqueado neste espaço de trabalho.");
    throw e;
  }
}
