import ExcelJS from "exceljs";
import type { AtaItem, Cabecalho, Participante } from "./ata-types";

const PART_INI = 10;
const PART_FIM = 37;
const ITEM_INI = 45;
const ITEM_FIM = 127;
const ROTULO: Record<AtaItem["acao"], string> = {
  "Tópico": "Tópico\nTopic",
  Informativo: "Informativo\nInformative",
  "Tarefa Pendente": "Tarefa Pendente\nPending Task",
};
const COLS = ["B", "C", "D", "E", "F", "G", "H", "I"] as const;

function parseData(s: string | null): Date | string {
  if (!s) return "";
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3]!, +m[2]! - 1, +m[1]!));
  return s;
}

function tryUnmerge(ws: ExcelJS.Worksheet, range: string) {
  try {
    ws.unMergeCells(range);
  } catch {
    // The range may already be unmerged.
  }
}

export async function gerarExcel(cab: Cabecalho, participantes: Participante[], itens: AtaItem[]): Promise<Blob> {
  // The official workbook is stored in /public, so Vite's configured base path is respected.
  const templateUrl = `${import.meta.env.BASE_URL}modelo-ata.xlsx`;
  const response = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error(`Não foi possível carregar o modelo oficial da ata (HTTP ${response.status}).`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await response.arrayBuffer());
  const ws = wb.getWorksheet("Ata - Minute") ?? wb.worksheets[0];
  if (!ws) throw new Error("A planilha 'Ata - Minute' não foi encontrada no modelo oficial.");

  // Header fields: write only into the designated cells, preserving the template's labels and layout.
  ws.getCell("D4").value = cab.cliente;
  ws.getCell("D5").value = cab.projeto;
  ws.getCell("D6").value = cab.local;
  ws.getCell("D7").value = cab.elaboracao;
  ws.getCell("H5").value = cab.docNumero;
  ws.getCell("H6").value = cab.horaInicio;
  ws.getCell("H7").value = cab.horaTermino;
  if (cab.data) {
    const [y = 0, m = 1, d = 1] = cab.data.split("-").map(Number);
    ws.getCell("H4").value = new Date(Date.UTC(y, m - 1, d));
  } else {
    ws.getCell("H4").value = null;
  }

  // Clear old participant data without touching formatting or the participant section.
  for (let r = PART_INI; r <= PART_FIM; r++) {
    for (const c of ["B", "E", "F", "I"]) ws.getCell(`${c}${r}`).value = null;
  }
  participantes.slice(0, PART_FIM - PART_INI + 1).forEach((p, i) => {
    const r = PART_INI + i;
    ws.getCell(`B${r}`).value = p.nome;
    ws.getCell(`E${r}`).value = p.empresa;
    ws.getCell(`F${r}`).value = p.email;
    ws.getCell(`I${r}`).value = p.visto;
  });

  // Preserve the official styles by using the template's example row for each record type.
  const estilo = (row: number) =>
    Object.fromEntries(COLS.map((c) => [c, structuredClone(ws.getCell(`${c}${row}`).style)]));
  const modelos = {
    "Tópico": estilo(46),
    Informativo: estilo(47),
    "Tarefa Pendente": estilo(49),
  } satisfies Record<AtaItem["acao"], Record<string, ExcelJS.Style>>;

  // Remove old meeting content and merges before creating the new item list.
  for (let r = ITEM_INI; r <= ITEM_FIM; r++) {
    tryUnmerge(ws, `C${r}:F${r}`);
    ws.getCell(`A${r}`).value = null;
    for (const c of COLS) ws.getCell(`${c}${r}`).value = null;
  }

  const capacidade = ITEM_FIM - ITEM_INI + 1;
  if (itens.length > capacidade) {
    ws.duplicateRow(ITEM_FIM, itens.length - capacidade, true);
  }

  itens.forEach((it, i) => {
    const r = ITEM_INI + i;
    const st = modelos[it.acao];
    for (const c of COLS) ws.getCell(`${c}${r}`).style = structuredClone(st[c] ?? {});
    const isTopo = !it.numero.includes(".");
    ws.getCell(`B${r}`).value = isTopo ? Number(it.numero) : it.numero;
    ws.getCell(`C${r}`).value = it.assunto;
    ws.getCell(`G${r}`).value = ROTULO[it.acao];
    ws.getCell(`H${r}`).value =
      it.acao === "Tarefa Pendente" ? parseData(it.prazo) || "[CONFIRMAR PRAZO]" : "N/A";
    ws.getCell(`I${r}`).value = it.responsavel || "[CONFIRMAR RESPONSÁVEL]";
    ws.mergeCells(`C${r}:F${r}`);

    const linhas = it.assunto.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 105)), 0);
    ws.getRow(r).height = Math.max(isTopo ? 20 : 30, linhas * 15 + 6);
  });

  const ultima = itens.length ? ITEM_INI + itens.length - 1 : ITEM_INI - 1;
  // Strip old sample rows completely (values, styles, merges and excess row height).
  for (let r = ultima + 1; r <= Math.max(ITEM_FIM, ws.rowCount); r++) {
    tryUnmerge(ws, `C${r}:F${r}`);
    for (const c of ["A", ...COLS, "J"]) {
      const cell = ws.getCell(`${c}${r}`);
      cell.value = null;
      cell.style = {};
    }
    ws.getRow(r).height = 15;
  }

  ws.pageSetup.printArea = `B1:I${Math.max(ITEM_INI, ultima)}`;
  const out = await wb.xlsx.writeBuffer();
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
