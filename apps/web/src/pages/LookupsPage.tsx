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
import { EmptyState, PageHeader, useToast } from "../ui";

export function LookupsPage() {
  const [tables, setTables] = useState<Array<{ table_key: string; label_fr: string }>>([]);
  const [table, setTable] = useState("fournisseur");
  const [rows, setRows] = useState<Array<{ id: number; nom: string }>>([]);
  const [nom, setNom] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingNom, setEditingNom] = useState("");
  const { toast } = useToast();

  const load = (t: string) =>
    api.get<{ rows: Array<{ id: number; nom: string }> }>(`/api/lookups/${t}`).then((r) => setRows(r.rows));

  useEffect(() => {
    api.get<{ tables: Array<{ table_key: string; label_fr: string }> }>("/api/lookups").then((r) => setTables(r.tables));
    load(table);
  }, []);

  return (
    <div>
      <PageHeader title="Référentiels">
        Affichage du nom. Rapprochement à l&apos;import : nom unique, insensible à la casse et aux espaces.
      </PageHeader>
      <div className="mi20-toolbar">
        <Dropdown
          style={{ minWidth: 260 }}
          value={tables.find((t) => t.table_key === table)?.label_fr ?? table}
          selectedOptions={[table]}
          onOptionSelect={(_, d) => {
            const v = d.optionValue ?? table;
            setTable(v);
            setEditingId(null);
            load(v);
          }}
        >
          {tables.map((t) => (
            <Option key={t.table_key} value={t.table_key} text={t.label_fr}>
              {t.label_fr}
            </Option>
          ))}
        </Dropdown>
        <Input value={nom} onChange={(_, d) => setNom(d.value)} placeholder="Nouveau nom" />
        <Button
          appearance="primary"
          onClick={async () => {
            try {
              await api.post(`/api/lookups/${table}`, { nom });
              toast("success", "Ligne ajoutée", nom);
              setNom("");
              load(table);
            } catch (e) {
              toast("error", "Référentiel", e instanceof Error ? e.message : "échec");
            }
          }}
        >
          Ajouter
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Aucune valeur" detail="Ajoutez un nom pour ce référentiel." />
      ) : (
        <div className="mi20-table-wrap">
          <Table size="extra-small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Nom</TableHeaderCell>
                <TableHeaderCell />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {editingId === r.id ? (
                      <Input value={editingNom} onChange={(_, d) => setEditingNom(d.value)} />
                    ) : (
                      r.nom
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === r.id ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button
                          size="small"
                          appearance="primary"
                          onClick={async () => {
                            try {
                              await api.put(`/api/lookups/${table}/${r.id}`, { nom: editingNom });
                              toast("success", "Nom enregistré", editingNom);
                              setEditingId(null);
                              load(table);
                            } catch (e) {
                              toast("error", "Référentiel", e instanceof Error ? e.message : "échec");
                            }
                          }}
                        >
                          Enregistrer
                        </Button>
                        <Button size="small" onClick={() => setEditingId(null)}>
                          Annuler
                        </Button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button
                          size="small"
                          onClick={() => {
                            setEditingId(r.id);
                            setEditingNom(r.nom);
                          }}
                        >
                          Modifier
                        </Button>
                        <Button
                          size="small"
                          onClick={async () => {
                            try {
                              await api.del(`/api/lookups/${table}/${r.id}`);
                              load(table);
                            } catch (e) {
                              toast("error", "Référentiel", e instanceof Error ? e.message : "échec");
                            }
                          }}
                        >
                          Supprimer
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
