import {
  Body1,
  Button,
  Dropdown,
  Field,
  Input,
  Option,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Title3,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

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

  const reload = () => api.get<{ rows: Bx[] }>("/api/bordereaux").then((r) => setRows(r.rows));

  useEffect(() => {
    reload();
    api.get<{ rows: Array<{ id: number; nom: string }> }>("/api/lookups/Leader").then((r) => {
      setLeaders(r.rows);
      if (r.rows[0]) setLeaderId(String(r.rows[0].id));
    });
  }, []);

  return (
    <div>
      <Title3>Bordereaux</Title3>
      <Body1>
        Form_CREATE_BX / Form_MGT_BX — template MI20_BORD_TEMPLATE_M5_V12.xls. Dossier EXPORT_BX/MI20_BORD_&lt;code&gt;/.
      </Body1>
      <div style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap", alignItems: "end" }}>
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
            const r = await api.post<{ id: number }>("/api/bordereaux", {
              idLeader: Number(leaderId),
              numero: numero ? Number(numero) : undefined,
            });
            nav(`/bordereaux/${r.id}`);
          }}
        >
          Créer
        </Button>
      </div>
      <Table>
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
  );
}
