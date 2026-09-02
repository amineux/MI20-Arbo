import { formatLigne } from "./ligne.js";
import { matchJalonDef } from "./jalon.js";
import { formatOuiNon } from "./oui-non.js";
import type {
  CompareRow,
  DocumentSnapshot,
  ImportColumn,
  JalonDef,
  LookupCatalog,
  StagedDocument,
} from "./types.js";

export interface ComputeDifferencesInput {
  staged: StagedDocument[];
  existing: DocumentSnapshot[];
  columns: ImportColumn[];
  lookups: LookupCatalog;
  jalons: JalonDef[];
}

export function computeDifferences(input: ComputeDifferencesInput): CompareRow[] {
  const byKey = new Map<string, DocumentSnapshot>();
  for (const doc of input.existing) {
    byKey.set(docKey(doc.groupeLigne, doc.indiceLigne), doc);
  }

  const diffs: CompareRow[] = [];
  for (const row of input.staged) {
    if (row.groupeLigne === null) continue;
    const key = docKey(row.groupeLigne, row.indiceLigne);
    const current = byKey.get(key);
    row.isNew = !current;
    const titre = String(row.fields.Titre ?? current?.fields.Titre ?? "");

    if (!current) {
      diffs.push(
        makeCompare({
          row,
          titre,
          fieldName: "_nouveau",
          fieldLabel: "Nouveau document",
          oldValue: "",
          newValue: formatLigne(row.groupeLigne, row.indiceLigne),
          nouveau: true,
          table: "document",
        }),
      );
    }

    for (const col of input.columns) {
      if (!col.toImport) continue;
      if (col.nature === "J" || col.nature === "LIGNE") continue;
      const newRaw = row.fields[col.documentField];
      const oldRaw = current?.fields[col.documentField];
      const newDisp = displayValue(col, newRaw, row.displayFields[col.documentField], input.lookups);
      const oldDisp = current
        ? displayValue(col, oldRaw, undefined, input.lookups)
        : "";
      if (normalizeCmp(oldDisp) === normalizeCmp(newDisp) && current) continue;
      if (!current && (newRaw === undefined || newRaw === null || newRaw === "")) continue;
      diffs.push(
        makeCompare({
          row,
          titre,
          fieldName: col.documentField,
          fieldLabel: col.ppdTitle,
          oldValue: oldDisp,
          newValue: newDisp,
          nouveau: !current,
          table: col.destTable || "document",
        }),
      );
    }

    for (const slot of row.jalons) {
      const def = matchJalonDef(slot, input.jalons);
      const code = def?.code ?? slot.nom;
      const oldJ = current?.jalons.find(
        (j) => j.code.toUpperCase() === code.toUpperCase() || j.nom?.toUpperCase() === slot.nom.toUpperCase(),
      );
      const newVal = [slot.valeur, slot.date ?? ""].filter(Boolean).join(" | ");
      const oldVal = oldJ ? [oldJ.valeur, oldJ.date ?? ""].filter(Boolean).join(" | ") : "";
      if (normalizeCmp(oldVal) === normalizeCmp(newVal) && !slot.estPrevisionnel === !oldJ?.estPrevisionnel) {
        continue;
      }
      if (!newVal && !oldVal) continue;
      diffs.push(
        makeCompare({
          row,
          titre,
          fieldName: `Jalon:${code}`,
          fieldLabel: `Jalon ${code}`,
          oldValue: oldVal,
          newValue: newVal,
          nouveau: !current,
          table: "programmation_jalon",
          oldEstPrevisionnel: oldJ?.estPrevisionnel ?? false,
          newEstPrevisionnel: slot.estPrevisionnel,
        }),
      );
    }
  }
  return diffs;
}

export function docKey(groupeLigne: number, indiceLigne: string): string {
  return `${groupeLigne}::${(indiceLigne ?? "").trim()}`;
}

function normalizeCmp(value: string): string {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

function displayValue(
  col: ImportColumn,
  raw: unknown,
  fallbackDisplay: string | undefined,
  lookups: LookupCatalog,
): string {
  if (col.nature === "OUINON" || col.nature === "AUTORISANT") {
    if (typeof raw === "boolean") return formatOuiNon(raw);
    return fallbackDisplay ?? "";
  }
  if ((col.nature === "LDD" || col.nature === "LDDDomaineChargeur") && typeof raw === "number") {
    const table = col.associatedTable ?? "";
    const rows = lookups[table] ?? lookups[table.toLowerCase()] ?? [];
    const hit = rows.find((r) => r.id === raw);
    return hit?.nom ?? String(raw);
  }
  if (raw === null || raw === undefined) return fallbackDisplay ?? "";
  return fallbackDisplay ?? String(raw);
}

function makeCompare(args: {
  row: StagedDocument;
  titre: string;
  fieldName: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  nouveau: boolean;
  table: string;
  oldEstPrevisionnel?: boolean;
  newEstPrevisionnel?: boolean;
}): CompareRow {
  return {
    groupeLigne: args.row.groupeLigne ?? 0,
    indiceLigne: args.row.indiceLigne,
    titreFr: args.titre,
    fieldName: args.fieldName,
    fieldLabel: args.fieldLabel,
    oldValue: args.oldValue,
    newValue: args.newValue,
    oldValueBrut: args.oldValue,
    newValueBrut: args.newValue,
    isImported: false,
    nouveauDocument: args.nouveau,
    table: args.table,
    oldEstPrevisionnel: args.oldEstPrevisionnel ?? false,
    newEstPrevisionnel: args.newEstPrevisionnel ?? false,
  };
}
