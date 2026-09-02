import {
  Body1,
  Button,
  Dropdown,
  Input,
  Option,
  Spinner,
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

interface DocRow {
  Id: number;
  GroupeLigne: number;
  IndiceLigne: string;
  RefExt: string;
  Titre: string;
  Revision: string;
  Livrable: string;
  FournisseurNom?: string;
  DomaineChargeurNom?: string;
}

interface LookupOpt {
  id: number;
  nom: string;
}

export function DocumentsPage() {
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [fournisseurId, setFournisseurId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; rows: DocRow[] } | null>(null);
  const [fournisseurs, setFournisseurs] = useState<LookupOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ rows: LookupOpt[] }>("/api/lookups/fournisseur").then((r) => setFournisseurs(r.rows));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      const q = new URLSearchParams({ search, page: String(page), pageSize: "50" });
      if (fournisseurId) q.set("fournisseurId", fournisseurId);
      api
        .get<{ total: number; rows: DocRow[] }>(`/api/documents?${q}`)
        .then(setData)
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [search, fournisseurId, page]);

  return (
    <div>
      <Title3>Documents</Title3>
      <Body1>Form_EDIT_DOC + Form_FILTRES_RECHERCHE — clé métier GroupeLigne + IndiceLigne.</Body1>
      <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
        <Input
          style={{ minWidth: 280 }}
          placeholder="Titre, réf. externe, n° ligne…"
          value={search}
          onChange={(_, d) => {
            setSearch(d.value);
            setPage(1);
          }}
        />
        <Dropdown
          placeholder="Fournisseur"
          style={{ minWidth: 200 }}
          selectedOptions={fournisseurId ? [fournisseurId] : []}
          onOptionSelect={(_, d) => {
            setFournisseurId(d.optionValue === "all" ? "" : (d.optionValue ?? ""));
            setPage(1);
          }}
        >
          <Option value="all">Tous</Option>
          {fournisseurs.map((f) => (
            <Option key={f.id} value={String(f.id)}>
              {f.nom}
            </Option>
          ))}
        </Dropdown>
      </div>
      {loading ? <Spinner label="Chargement" /> : null}
      {error ? <Body1>{error}</Body1> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>N° ligne</TableHeaderCell>
            <TableHeaderCell>Réf. externe</TableHeaderCell>
            <TableHeaderCell>Titre</TableHeaderCell>
            <TableHeaderCell>Indice</TableHeaderCell>
            <TableHeaderCell>Fournisseur</TableHeaderCell>
            <TableHeaderCell>Livrable</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data?.rows ?? []).map((r) => (
            <TableRow key={r.Id} onClick={() => nav(`/documents/${r.Id}`)} style={{ cursor: "pointer" }}>
              <TableCell>
                {r.GroupeLigne} / {r.IndiceLigne}
              </TableCell>
              <TableCell>{r.RefExt}</TableCell>
              <TableCell>{r.Titre}</TableCell>
              <TableCell>{r.Revision}</TableCell>
              <TableCell>{r.FournisseurNom}</TableCell>
              <TableCell>{r.Livrable}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Précédent
        </Button>
        <Body1>
          Page {page} — {data?.total ?? 0} document(s)
        </Body1>
        <Button disabled={(data?.rows.length ?? 0) < 50} onClick={() => setPage((p) => p + 1)}>
          Suivant
        </Button>
      </div>
    </div>
  );
}
