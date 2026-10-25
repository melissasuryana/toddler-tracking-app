export interface CsvRow {
  readonly line: number;
  readonly cells: readonly string[];
  readonly malformed: boolean;
}

/** Quotes may contain commas/newlines; an unmatched quote makes the file unparseable. */
export function parseCsv(input: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  let malformed = false;
  let line = 1;
  let rowLine = 1;
  let raw = "";
  const finishCell = () => {
    cells.push(cell.trim());
    cell = "";
    closedQuote = false;
  };
  const finishRow = () => {
    finishCell();
    if (raw.trim()) rows.push({ line: rowLine, cells, malformed });
    cells = [];
    raw = "";
    malformed = false;
    rowLine = line + 1;
  };
  const source = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (source.includes("\0")) throw new Error("CSV contains a NUL character.");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (quoted) {
      raw += char;
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          raw += source[++index];
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        cell += char;
        if (char === "\n") line += 1;
      }
    } else if (char === "\n") {
      finishRow();
      line += 1;
    } else {
      raw += char;
      if (char === ",") finishCell();
      else if (char === '"' && !cell.trim() && !closedQuote) {
        cell = "";
        quoted = true;
      } else {
        if (char === '"' || (closedQuote && char.trim())) malformed = true;
        cell += char;
      }
    }
  }
  if (quoted) throw new Error("CSV has an unterminated quoted cell.");
  finishRow();
  return rows;
}
