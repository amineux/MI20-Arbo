import {
  Button,
  Dropdown,
  Input,
  Option,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { api } from "../api";
import { PageHeader, useToast } from "../ui";

export function LookupsPage() {
  const [tables, setTables] = useState<Array<{ table_key: string; label_fr: string }>>([]);
  const [table, setTable] = useState("fournisseur");
  const [rows, setRows] = useState<Array<{ id: number; nom: string }>>([]);
  const [nom, setNom] = useState("");
  const { toast } = useToast();

  const load = (t: string) => api.get<{ rows: Array<{ id: number; nom: string }> }>(`/api/lookups/${t}`).then((r) => setRows(r.rows));

  useEffect(() => {
    api.get<{ tables: Array<{ table_key: string; label_fr: string }> }>("/api/lookups").then((r) => setTables(r.tables));
    load(table);
  }, []);

  return (
    <div>
      <PageHeader title="Référentiels" form="tables LDD">
        Affichage Nom. Rapprochement import PPD : <code>UCase(Trim(Nom))</code>. CRUD Nom uniquement.
      </PageHeader>
      <div style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
        <Dropdown
          style={{ minWidth: 260 }}
          value={tables.find((t) => t.table_key === table)?.label_fr ?? table}
          selectedOptions={[table]}
          onOptionSelect={(_, d) => {
            const v = d.optionValue ?? table;
            setTable(v);
            load(v);
          }}
        >
          {tables.map((t) => (
            <Option key={t.table_key} value={t.table_key} text={`${t.label_fr} (${t.table_key})`}>
              {`${t.label_fr} (${t.table_key})`}
            </Option>
          ))}
        </Dropdown>
        <Input value={nom} onChange={(_, d) => setNom(d.value)} placeholder="Nouveau nom" />
        <Button
          appearance="primary"
          onClick={async () => {
            await api.post(`/api/lookups/${table}`, { nom });
            setNom("");
            load(table);
            toast("success", "Ligne ajoutée", nom);
          }}
        >
          Ajouter
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Id</TableHeaderCell>
            <TableHeaderCell>Nom</TableHeaderCell>
            <TableHeaderCell />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.id}</TableCell>
              <TableCell>{r.nom}</TableCell>
              <TableCell>
                <Button
                  size="small"
                  onClick={async () => {
                    await api.del(`/api/lookups/${table}/${r.id}`);
                    load(table);
                  }}
                >
                  Supprimer
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
