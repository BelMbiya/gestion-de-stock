"use client";

import { Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { AssetSearchSelect } from "@/components/asset-search-select";
import { ExportPdfButton } from "@/components/export-pdf-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ui } from "@/lib/ui-styles";
import { KYC_UI } from "@/lib/kyc-excel/terminology";

type ReferenceItem = {
  id: string;
  name: string;
  sku?: string;
  serialNumber?: string | null;
  model?: string | null;
};

type MovementItem = {
  id: string;
  asset: string;
  fromLocation: string;
  movedAt: string;
  performedBy: string;
  quantity: number;
  reason: string;
  toLocation: string;
  type: string;
};

const emptyForm = {
  assetId: "",
  fromLocationId: "",
  quantity: "1",
  reason: "",
  toLocationId: "",
  type: "ADJUSTMENT",
};

export function MovementsContent() {
  const [assets, setAssets] = useState<ReferenceItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [locations, setLocations] = useState<ReferenceItem[]>([]);
  const [movements, setMovements] = useState<MovementItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMovements = movements.filter((movement) => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) {
      return true;
    }

    return [
      movement.asset,
      movement.fromLocation,
      movement.movedAt,
      movement.performedBy,
      movement.reason,
      movement.toLocation,
      movement.type,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  async function loadMovements() {
    const response = await fetch("/api/movements", { cache: "no-store" });
    const data = await response.json();
    setAssets(data.assets);
    setLocations(data.locations);
    setMovements(data.movements);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMovements();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await fetch("/api/movements", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setForm(emptyForm);
    setIsFormOpen(false);
    await loadMovements();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/movements/${id}`, { method: "DELETE" });
    await loadMovements();
  }

  return (
    <section className={ui.page}>
      <header className={`${ui.header} md:flex md:items-center md:justify-between`}>
        <div>
          <p className={ui.eyebrow}>{KYC_UI.MOVEMENTS}</p>
          <h1 className={ui.title}>{KYC_UI.MOVEMENTS}</h1>
          <p className={`${ui.subtitle} mt-1 max-w-2xl`}>
            Enregistrez les entrees, sorties, retours, ajustements et transferts.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 md:mt-0">
          <ExportPdfButton
            filename="mouvements-stock"
            sections={[
              {
                columns: [
                  KYC_UI.DESCRIPTION,
                  KYC_UI.TYPE,
                  KYC_UI.FROM,
                  KYC_UI.TO,
                  KYC_UI.REASON,
                  KYC_UI.DATE,
                  KYC_UI.USER,
                ],
                rows: filteredMovements.map((movement) => [
                  movement.asset,
                  movement.type,
                  movement.fromLocation,
                  movement.toLocation,
                  movement.reason,
                  movement.movedAt,
                  movement.performedBy,
                ]),
              },
            ]}
            subtitle={`PROCO & Cie - ${filteredMovements.length} mouvement(s)`}
            title={`${KYC_UI.MOVEMENTS} IT`}
          />
          <Button
            className={ui.btnPrimary}
            onClick={() => setIsFormOpen(true)}
            type="button"
          >
            Ajouter un mouvement
          </Button>
        </div>
      </header>

      <Dialog onOpenChange={setIsFormOpen} open={isFormOpen}>
        <DialogContent className="w-[min(calc(100vw-2rem),52rem)] max-w-none border-white/10 bg-[#11183b] p-6 text-white sm:max-w-none">
          <DialogHeader>
            <DialogTitle>Ajouter un mouvement</DialogTitle>
            <DialogDescription className="text-slate-400">
              Chaque mouvement est conserve dans la tracabilite.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 md:grid-cols-2 [&_input]:h-11 [&_select]:h-11"
            onSubmit={handleSubmit}
          >
            <AssetSearchSelect
              assets={assets}
              label={KYC_UI.DESCRIPTION}
              onValueChange={(assetId) =>
                setForm((value) => ({ ...value, assetId }))
              }
              required
              value={form.assetId}
            />
            <select
              className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm"
              onChange={(event) =>
                setForm((value) => ({ ...value, type: event.target.value }))
              }
              value={form.type}
            >
              <option value="IN">Entree</option>
              <option value="OUT">Sortie</option>
              <option value="TRANSFER">Transfert</option>
              <option value="ADJUSTMENT">Ajustement</option>
              <option value="RETURN">Retour</option>
            </select>
            <select
              className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm"
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  fromLocationId: event.target.value,
                }))
              }
              value={form.fromLocationId}
            >
              <option value="">Depuis</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm"
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  toLocationId: event.target.value,
                }))
              }
              value={form.toLocationId}
            >
              <option value="">Vers</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <Input
              className="border-white/10 bg-white/6 md:col-span-2"
              onChange={(event) =>
                setForm((value) => ({ ...value, reason: event.target.value }))
              }
              placeholder="Motif"
              value={form.reason}
            />
            <Button
              className={`md:col-span-2 ${ui.btnPrimary}`}
              type="submit"
            >
              Enregistrer
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <Input
          className={`${ui.input} pl-9`}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={`${KYC_UI.DESCRIPTION}, ${KYC_UI.TYPE}, ${KYC_UI.LOCATION}, ${KYC_UI.REASON}…`}
          value={searchQuery}
        />
      </div>

      <Card className={`${ui.panel} ${ui.tablePanel}`}>
        <CardContent className={ui.tablePanelBody}>
          <div className={ui.tableWrap}>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                { [KYC_UI.DESCRIPTION, "Type", "Depuis", "Vers", "Motif", "Date", "Actions"].map(
                  (head) => (
                    <TableHead className="text-xs text-slate-500" key={head}>
                      {head}
                    </TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.map((movement) => (
                <TableRow className="border-white/6" key={movement.id}>
                  <TableCell>{movement.asset}</TableCell>
                  <TableCell>{movement.type}</TableCell>
                  <TableCell>{movement.fromLocation}</TableCell>
                  <TableCell>{movement.toLocation}</TableCell>
                  <TableCell>{movement.reason}</TableCell>
                  <TableCell>{movement.movedAt}</TableCell>
                  <TableCell>
                    <Button
                      className="bg-red-900/30 text-red-200 hover:bg-red-900/50"
                      onClick={() => handleDelete(movement.id)}
                      size="sm"
                    >
                      Supprimer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
