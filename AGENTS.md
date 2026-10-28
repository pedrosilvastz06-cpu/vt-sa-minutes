<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Atas: the Excel export fills the company template `public/modelo-ata.xlsx` in the browser (exceljs), copying styles from its example rows — never rebuild the layout from scratch, so the official template stays 100% intact.
- Atas: AI organizes notes in `src/lib/ata.server.ts`; fixed opening/closing rows and numbering are added in code (`montarItens`), not by the AI.
- Atas: each AI item carries its source-note line; `ata-order.ts` restores source order and splits resumed topic runs before review/export, so thematic grouping cannot override note chronology.
