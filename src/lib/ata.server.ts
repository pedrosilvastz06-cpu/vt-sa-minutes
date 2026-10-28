import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./ai/run-id";
import { ordenarPelaOrigem, textoNaOrdem } from "./ata-order";

const schema = z.object({
  itens: z.array(
    z.object({
      numero: z.string(),
      linhaOrigem: z.number(),
      assunto: z.string(),
      acao: z.enum(["Tópico", "Informativo", "Tarefa Pendente"]),
      prazo: z.string().nullable(),
      responsavel: z.string().nullable(),
    }),
  ),
  textoCorrido: z.string(),
  alertas: z.array(z.string()),
});

export type GerarResultado = {
  itens: import("./ata-types").AtaItem[];
  textoCorrido: string;
  alertas: string[];
};

const INSTRUCOES = `Você organiza atas de reunião em português do Brasil para a equipe comercial da HS-Negócios / VetterTec Brasil (soluções industriais de secagem, desidratação mecânica e evaporação).

Transforme as anotações (fonte principal) e, se houver, a transcrição (fonte complementar) em registros de ata.

REGRAS OBRIGATÓRIAS
- NÃO inclua "Abertura" nem "Encerramento": o sistema adiciona automaticamente. Comece a numeração dos tópicos em 2.
- COMPLETUDE (prioridade máxima): TODA informação, frase, pergunta, resposta, decisão, número, data e tarefa das anotações deve aparecer na ata. Não resuma, não omita, não descarte nada por parecer pouco importante. Antes de responder, confira linha por linha das anotações se cada uma virou um registro. Se uma linha tiver mais de um fato, crie um registro para cada.
- Mantenha EXATAMENTE a ordem em que os assuntos aparecem nas anotações (ordem cronológica anotada). Não reordene, não agrupe assuntos de partes diferentes e não mova registros entre tópicos. Cada novo assunto nas anotações vira um novo tópico na mesma sequência.
- ORIGEM OBRIGATÓRIA: as linhas das anotações estão identificadas por [L1], [L2], etc. Para CADA registro e tópico, preencha linhaOrigem com o número da linha que originou aquele fato. Nunca invente a posição nem use a numeração da ata como origem. Fatos distintos da mesma linha mantêm a ordem textual. Não junte fatos de linhas não consecutivas num único registro.
- Se um assunto reaparecer depois de outro, abra NOVO tópico naquele ponto, mesmo que tenha o mesmo título: A → B → A permanece A → B → A, nunca A → A → B. Datas e prazos citados não são critérios de ordenação. A transcrição apenas esclarece os registros das anotações; informações complementares ficam ancoradas na linha relacionada, sem deslocar a fonte principal.
- Numeração hierárquica: tópico "2"; registros "2.1", "2.2"; respostas/desdobramentos "2.1.1", "2.1.2".
- Cada tópico (numero sem ponto) tem acao "Tópico", prazo "N/A", responsavel "Todos - All" e assunto no formato "Título em Português - Title in English", com a inicial de cada palavra em maiúscula (exceto artigos/preposições), ex.: "Pedido de Compra da Unidade #71 - Purchase Order for Unit #71".
- Registros: acao "Informativo" (algo dito, informado, decidido) ou "Tarefa Pendente" (alguém se comprometeu a fazer algo).
- Informativo: prazo "N/A"; responsavel = quem falou (primeiro nome, como nas anotações).
- Tarefa Pendente: prazo no formato dd/mm/aaaa se foi informado; se NÃO foi informado, prazo null (nunca invente). responsavel = quem executará; se não estiver claro, null.
- REESCRITA PROFISSIONAL (obrigatória): NÃO copie as anotações literalmente. Reescreva cada registro em português formal, gramaticalmente correto (concordância, regência, crase, pontuação e acentuação), claro e objetivo, em terceira pessoa e no pretérito: "Paul informou que...", "Fábio solicitou a Paul que...", "Paul confirmou que enviará...". Elimine gírias, abreviações informais ("vc", "pq", "tb", "msg"), repetições e frases truncadas. Não distorça o sentido.
- INGLÊS: em todo registro (não tópico), o assunto tem DUAS linhas separadas por "\\n": 1ª linha em português; 2ª linha a versão em inglês americano natural, como um profissional dos Estados Unidos escreveria (não tradução literal), com gramática, ortografia e pontuação 100% corretas do inglês dos EUA. Ex.: "Paul informou que enviará o desenho até sexta-feira.\\nPaul stated that he will send the drawing by Friday."
- Escreva sempre em MAIÚSCULAS as siglas: CFTI, ORCA, FGA, SADA, HS, VT-SA, VT-DE (ex.: "HS-Negócios", "Grupo SADA").
- Nomes de equipamentos em inglês ficam com a inicial de cada palavra maiúscula e não são traduzidos: "Ring Dryer", "Tube Bundle Dryer", "Flash Dryer", "Screw Press", etc.
- Preserve exatamente nomes de pessoas, empresas, números de unidades (#51, #61), termos técnicos e siglas.
- Nunca invente informações, decisões, responsáveis ou prazos.
- textoCorrido: a ata em texto corrido, em parágrafos por tópico, só em português, para revisão de clareza e fidelidade.
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

  const linhas = input.anotacoes.split(/\r?\n/);
  const prompt = `Data da reunião: ${input.dataReuniao || "não informada"}
Participantes: ${input.participantes || "não informados"}

=== ANOTAÇÕES (fonte principal) ===
${linhas.map((linha, i) => `[L${i + 1}] ${linha}`).join("\n")}

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
        reasoningEffort: "high",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  } as Parameters<typeof streamText>[0]);

  try {
    const resposta = await result.output as z.infer<typeof schema>;
    const itens = ordenarPelaOrigem(resposta.itens, linhas.length);
    return { itens, textoCorrido: textoNaOrdem(itens), alertas: resposta.alertas };
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
