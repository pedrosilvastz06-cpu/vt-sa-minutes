import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, FileUp, Loader2, Plus, Sparkles, Trash2, Copy, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { gerarAtaFn } from "@/lib/ata.functions";
import {
  type Acao,
  type AtaItem,
  type Cabecalho,
  type Participante,
  CONFIRMAR_PRAZO,
  montarItens,
  padronizarSiglas,
  pendenciasAbertas,
  prazoPadrao,
  renumerar,
} from "@/lib/ata-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gerador de Atas VT-SA" },
      { name: "description", content: "Transforme anotações de reunião em atas no modelo Excel da VetterTec." },
      { property: "og:title", content: "Gerador de Atas VT-SA" },
      { property: "og:description", content: "Transforme anotações de reunião em atas no modelo Excel da VetterTec." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const PARTICIPANTES_PADRAO: Participante[] = [
  { nome: "Paul Prohaska", empresa: "VetterTec DE - Gerente de Projetos - Project Manager", email: "Paul.Prohaska@vettertec.com", visto: "Presente - Present (via Teams)" },
  { nome: "Steen Hedetoft", empresa: "VetterTec SA - Diretor - Director SA", email: "steen.hedetoft@vettertec.com", visto: "Presente - Present (via Teams)" },
  { nome: "Jonas Range", empresa: "VetterTec DE - Gerente de Projetos - Project Manager", email: "jonas.range@vettertec.com", visto: "Presente - Present (via Teams)" },
  { nome: "Fabio Alcino", empresa: "HS-Negocios / VetterTec Br - Gestão de Projetos - Project Manager BR", email: "fabioalcino@fra-gerenc.com", visto: "Presente - Present" },
  { nome: "Anderson Kaszás", empresa: "HS-Negocios / VetterTec Br - Gestão de Documentos - Docs Management", email: "anderson@hs-negocios.com", visto: "Presente - Present" },
  { nome: "Pedro Borazo", empresa: "HS-Negocios / VetterTec Br - Administrativo - Administrative", email: "hs-negocios@hs-negocios.com", visto: "Presente - Present" },
];

const hoje = new Date().toISOString().slice(0, 10);

async function lerArquivo(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return r.value;
  }
  return file.text();
}

function Index() {
  const gerar = useServerFn(gerarAtaFn);
  const [cab, setCab] = useState<Cabecalho>({
    cliente: "VetterTec",
    projeto: "",
    local: "Virtual Teams",
    elaboracao: "Pedro Borazo",
    data: hoje,
    docNumero: "",
    horaInicio: "",
    horaTermino: "",
  });
  const [parts, setParts] = useState<Participante[]>(PARTICIPANTES_PADRAO);
  const [anotacoes, setAnotacoes] = useState("");
  const [transcricao, setTranscricao] = useState("");
  const [itens, setItens] = useState<AtaItem[] | null>(null);
  const [texto, setTexto] = useState("");
  const [alertas, setAlertas] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [baixando, setBaixando] = useState(false);

  const setC = (k: keyof Cabecalho) => (e: React.ChangeEvent<HTMLInputElement>) => setCab({ ...cab, [k]: e.target.value });

  async function anexar(e: React.ChangeEvent<HTMLInputElement>, alvo: "anotacoes" | "transcricao") {
    const files = Array.from(e.target.files ?? []);
    const textos = await Promise.all(files.map(lerArquivo));
    const junto = textos.join("\n\n");
    if (alvo === "anotacoes") setAnotacoes((a) => (a ? a + "\n\n" : "") + junto);
    else setTranscricao((a) => (a ? a + "\n\n" : "") + junto);
    e.target.value = "";
  }

  async function onGerar() {
    if (!anotacoes.trim()) {
      toast.error("Cole ou anexe suas anotações primeiro.");
      return;
    }
    setCarregando(true);
    try {
      const r = await gerar({
        data: {
          anotacoes,
          transcricao,
          participantes: parts.map((p) => `${p.nome} (${p.empresa})`).join("; "),
          dataReuniao: cab.data,
        },
      });
      setItens(montarItens(r.itens));
      setTexto(padronizarSiglas(r.textoCorrido));
      setAlertas(r.alertas);
      toast.success("Ata organizada. Revise antes de baixar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar a ata.");
    } finally {
      setCarregando(false);
    }
  }

  const upd = (i: number, patch: Partial<AtaItem>) => setItens((l) => l!.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const semPrazo = itens?.filter((i) => i.acao === "Tarefa Pendente" && (!i.prazo || i.prazo === CONFIRMAR_PRAZO)).length ?? 0;
  const abertas = itens ? pendenciasAbertas(itens).length : 0;

  function aplicarPrazoPadrao() {
    const p = prazoPadrao(cab.data);
    setItens((l) => l!.map((it) => (it.acao === "Tarefa Pendente" && (!it.prazo || it.prazo === CONFIRMAR_PRAZO) ? { ...it, prazo: p } : it)));
    toast.success(`Prazo padrão de 1 semana aplicado (${p}).`);
  }

  async function baixar() {
    if (!itens) return;
    if (abertas > 0 && !confirm(`Há ${abertas} tarefa(s) pendente(s) sem prazo ou responsável. Baixar mesmo assim?`)) return;
    setBaixando(true);
    try {
      const { gerarExcel } = await import("@/lib/ata-excel");
      const sig = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? padronizarSiglas(v) : v])) as T;
      const blob = await gerarExcel(sig(cab), parts.filter((p) => p.nome.trim()).map((p) => ({ ...sig(p), email: p.email })), itens.map(sig));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Ata ${cab.docNumero || cab.data}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error("Erro ao montar o Excel.");
      console.error(e);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-4 px-6 py-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">VetterTec South America</p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">Gerador de Atas VT-SA</h1>
          </div>
          <p className="hidden max-w-xs text-right text-sm opacity-80 sm:block">Anotações → ata no modelo Excel da empresa.</p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8">
        <Secao n="1" titulo="Dados da reunião">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo label="Cliente"><Input value={cab.cliente} onChange={setC("cliente")} /></Campo>
            <Campo label="Projeto" className="sm:col-span-2 lg:col-span-3"><Input value={cab.projeto} onChange={setC("projeto")} placeholder="Ex.: STARCHCANE® - Grupo SADA - #51, #61" /></Campo>
            <Campo label="Local"><Input value={cab.local} onChange={setC("local")} /></Campo>
            <Campo label="Elaboração"><Input value={cab.elaboracao} onChange={setC("elaboracao")} /></Campo>
            <Campo label="Data"><Input type="date" value={cab.data} onChange={setC("data")} /></Campo>
            <Campo label="Doc. Nº"><Input value={cab.docNumero} onChange={setC("docNumero")} placeholder="088-26-0" /></Campo>
            <Campo label="Hora início"><Input type="time" value={cab.horaInicio} onChange={setC("horaInicio")} /></Campo>
            <Campo label="Hora término"><Input type="time" value={cab.horaTermino} onChange={setC("horaTermino")} /></Campo>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-sm font-semibold">Participantes</Label>
              <Button variant="outline" size="sm" onClick={() => setParts([...parts, { nome: "", empresa: "", email: "", visto: "Presente - Present" }])}>
                <Plus /> Adicionar
              </Button>
            </div>
            <div className="grid gap-2">
              {parts.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_2fr_1.4fr_1.3fr_auto]">
                  <Input value={p.nome} placeholder="Nome" onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
                  <Input className="hidden sm:block" value={p.empresa} placeholder="Empresa - cargo" onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, empresa: e.target.value } : x)))} />
                  <Input className="hidden sm:block" value={p.email} placeholder="E-mail" onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
                  <Input className="hidden sm:block" value={p.visto} placeholder="Visto" onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, visto: e.target.value } : x)))} />
                  <Button variant="ghost" size="icon" aria-label="Remover participante" onClick={() => setParts(parts.filter((_, j) => j !== i))}><Trash2 /></Button>
                </div>
              ))}
            </div>
          </div>
        </Secao>

        <Secao n="2" titulo="Anotações">
          <div className="grid gap-4 lg:grid-cols-2">
            <Fonte label="Minhas anotações (principal)" valor={anotacoes} set={setAnotacoes} onFile={(e) => anexar(e, "anotacoes")} placeholder="Cole aqui suas anotações livres..." />
            <Fonte label="Transcrição Read AI (opcional)" valor={transcricao} set={setTranscricao} onFile={(e) => anexar(e, "transcricao")} placeholder="Use só se as anotações não forem suficientes." />
          </div>
          <Button size="lg" className="mt-5 w-full sm:w-auto" onClick={onGerar} disabled={carregando}>
            {carregando ? <Loader2 className="animate-spin" /> : <Sparkles />} {carregando ? "Organizando a ata..." : "Gerar ata"}
          </Button>
        </Secao>

        {itens && (
          <Secao n="3" titulo="Revisar e baixar">
            {(alertas.length > 0 || semPrazo > 0) && (
              <div className="mb-4 rounded-md border border-accent bg-pending p-4 text-sm text-pending-foreground">
                <p className="mb-1 font-semibold">Confirme antes de enviar:</p>
                <ul className="list-disc pl-5">
                  {alertas.map((a, i) => <li key={i}>{a}</li>)}
                  {semPrazo > 0 && <li>{semPrazo} tarefa(s) pendente(s) sem prazo informado.</li>}
                </ul>
                {semPrazo > 0 && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={aplicarPrazoPadrao}>
                    <CalendarClock /> Aplicar prazo padrão (1 semana)
                  </Button>
                )}
              </div>
            )}

            <Tabs defaultValue="tabela">
              <TabsList>
                <TabsTrigger value="tabela">Colunas do Excel</TabsTrigger>
                <TabsTrigger value="texto">Texto corrido</TabsTrigger>
              </TabsList>
              <TabsContent value="tabela">
                <div className="overflow-x-auto rounded-md border bg-card">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-secondary-foreground">
                      <tr><th className="p-2 w-16">Item</th><th className="p-2">Assunto</th><th className="p-2 w-40">Ação</th><th className="p-2 w-32">Prazo</th><th className="p-2 w-40">Responsável</th><th className="p-2 w-20"></th></tr>
                    </thead>
                    <tbody>
                      {itens.map((it, i) => {
                        const topo = it.acao === "Tópico";
                        return (
                          <tr key={i} className={`border-t align-top ${topo ? "bg-topic font-semibold" : it.acao === "Tarefa Pendente" ? "bg-pending/60" : ""}`}>
                            <td className="p-2 font-mono text-xs">{it.numero}</td>
                            <td className="p-1"><Textarea rows={topo ? 1 : 3} className="min-h-0 resize-y border-transparent bg-transparent shadow-none focus-visible:border-input" value={it.assunto} onChange={(e) => upd(i, { assunto: e.target.value })} /></td>
                            <td className="p-1">
                              <select className="w-full rounded-md border border-input bg-background p-2" value={it.acao} onChange={(e) => {
                                const acao = e.target.value as Acao;
                                setItens((l) => renumerar(l!.map((x, j) => (j !== i ? x : {
                                  ...x,
                                  acao,
                                  numero: acao === "Tópico" ? "1" : x.acao === "Tópico" ? "1.1" : x.numero,
                                  prazo: acao === "Tarefa Pendente" ? (x.prazo === "N/A" ? null : x.prazo) : "N/A",
                                  responsavel: acao === "Tópico" ? "Todos - All" : x.responsavel,
                                }))));
                              }}>
                                <option>Tópico</option>
                                <option>Informativo</option>
                                <option>Tarefa Pendente</option>
                              </select>
                            </td>
                            <td className="p-1">
                              {it.acao === "Tarefa Pendente" ? (
                                <Input value={it.prazo ?? ""} placeholder={CONFIRMAR_PRAZO} className={!it.prazo ? "border-destructive" : ""} onChange={(e) => upd(i, { prazo: e.target.value || null })} />
                              ) : <span className="block p-2 text-muted-foreground">N/A</span>}
                            </td>
                            <td className="p-1">
                              <Input value={it.responsavel ?? ""} placeholder="[CONFIRMAR RESPONSÁVEL]" className={!it.responsavel ? "border-destructive" : ""} onChange={(e) => upd(i, { responsavel: e.target.value || null })} />
                            </td>
                            <td className="p-1 whitespace-nowrap">
                              <Button variant="ghost" size="icon" aria-label="Adicionar linha abaixo" title="Adicionar linha abaixo" onClick={() => setItens((l) => {
                                const nova: AtaItem = { numero: topo ? `${it.numero}.1` : it.numero, assunto: "", acao: "Informativo", prazo: "N/A", responsavel: null };
                                return renumerar([...l!.slice(0, i + 1), nova, ...l!.slice(i + 1)]);
                              })}><Plus /></Button>
                              <Button variant="ghost" size="icon" aria-label="Remover linha" title="Remover linha" onClick={() => setItens((l) => renumerar(l!.filter((_, j) => j !== i)))}><Trash2 /></Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              <TabsContent value="texto">
                <Textarea rows={18} value={texto} onChange={(e) => setTexto(e.target.value)} className="bg-card" />
                <Button variant="outline" size="sm" className="mt-2" onClick={() => { navigator.clipboard.writeText(texto); toast.success("Texto copiado."); }}>
                  <Copy /> Copiar texto
                </Button>
              </TabsContent>
            </Tabs>

            <Button size="lg" variant="default" className="mt-5 bg-accent text-accent-foreground hover:bg-accent/90" onClick={baixar} disabled={baixando}>
              {baixando ? <Loader2 className="animate-spin" /> : <Download />} Baixar ata em Excel
            </Button>
          </Secao>
        )}
      </main>
    </div>
  );
}

function Secao({ n, titulo, children }: { n: string; titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="mb-5 flex items-center gap-3 font-display text-lg font-semibold">
        <span className="grid size-7 place-items-center rounded bg-primary text-sm text-primary-foreground">{n}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Campo({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Fonte({ label, valor, set, onFile, placeholder }: { label: string; valor: string; set: (v: string) => void; onFile: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">{label}</Label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-secondary">
          <FileUp className="size-3.5" /> Anexar .txt / .docx
          <input type="file" multiple accept=".txt,.md,.docx,.vtt,.srt" className="hidden" onChange={onFile} />
        </label>
      </div>
      <Textarea rows={12} value={valor} onChange={(e) => set(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
