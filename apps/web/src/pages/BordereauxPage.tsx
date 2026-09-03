import {
  Button,
  Dropdown,
  Field,
  Input,
  Option,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { EmptyState, PageHeader, useToast } from "../ui";

interface Bx {
  Id: number;
  NomComplet: string;
  Numero: number;
  DateEnvoi: string;
  LeaderNom?: string;
  NbEnvois: number;
}

export function BordereauxPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Bx[]>([]);
  const [leaders, setLeaders] = useState<Array<{ id: number; nom: string }>>([]);
  const [leaderId, setLeaderId] = useState<string>("");
  const [numero, setNumero] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const reload = () =>
    api
      .get<{ rows: Bx[] }>("/api/bordereaux")
      .then((r) => setRows(r.rows))
      .finally(() => setLoading(false));

  useEffect(() => {
    reload();
    api.get<{ rows: Array<{ id: number; nom: string }> }>("/api/lookups/Leader").then((r) => {
      setLeaders(r.rows);
      if (r.rows[0]) setLeaderId(String(r.rows[0].id));
    });
  }, []);

  return (
    <div>
      <PageHeader title="Bordereaux">
        En-tête CAF, rattachement de livrables, pack <code>EXPORT_BX/MI20_BORD_&lt;code&gt;/</code> (manifest +
        classeur).
      </PageHeader>
      <div className="mi20-toolbar">
        <Field label="Leader technique">
          <Dropdown
            style={{ minWidth: 180 }}
            value={leaders.find((l) => String(l.id) === leaderId)?.nom}
            selectedOptions={leaderId ? [leaderId] : []}
            onOptionSelect={(_, d) => setLeaderId(d.optionValue ?? "")}
          >
            {leaders.map((l) => (
              <Option key={l.id} value={String(l.id)}>
                {l.nom}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Numéro (optionnel)">
          <Input value={numero} onChange={(_, d) => setNumero(d.value)} placeholder="auto" />
        </Field>
        <Button
          appearance="primary"
          onClick={async () => {
            try {
              if (!leaderId) {
                toast("error", "Leader technique obligatoire");
                return;
              }
              const r = await api.post<{ id: number }>("/api/bordereaux", {
                idLeader: Number(leaderId),
                numero: numero ? Number(numero) : undefined,
              });
              toast("success", "Bordereau créé", "Rattachez des documents puis téléchargez le pack EXPORT_BX.");
              nav(`/bordereaux/${r.id}`);
            } catch (e) {
              toast("error", "Création bordereau", e instanceof Error ? e.message : "échec");
            }
          }}
        >
          Créer le bordereau
        </Button>
      </div>
      {loading ? (
        <Spinner label="Chargement des bordereaux…" />
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun bordereau" detail="Choisissez un leader technique puis créez l'en-tête." />
      ) : (
        <div className="mi20-table-wrap">
          <Table size="extra-small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Code</TableHeaderCell>
                <TableHeaderCell>Leader</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Envois</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.Id} style={{ cursor: "pointer" }} onClick={() => nav(`/bordereaux/${r.Id}`)}>
                  <TableCell>{r.NomComplet}</TableCell>
                  <TableCell>{r.LeaderNom}</TableCell>
                  <TableCell>{r.DateEnvoi}</TableCell>
                  <TableCell>{r.NbEnvois}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
