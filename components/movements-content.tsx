"use client";

import { Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

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

type ReferenceItem = {
  id: string;
  name: string;
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
    <section className="flex h-full min-h-0 flex-col gap-5 text-white">
      <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/6 p-5 shadow-2xl shadow-black/30 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#6fb6ff]">
            Mouvements
          </p>
          <h1 className="mt-2 text-3xl font-black">Mouvements de stock</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Enregistrez les entrees, sorties, retours, ajustements et transferts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportPdfButton
            filename="mouvements-stock"
            sections={[
              {
                columns: ["Materiel", "Type", "Depuis", "Vers", "Motif", "Date", "Agent"],
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
            title="Mouvements de stock IT"
          />
          <Button
            className="w-fit bg-[#ff2f45] text-white hover:bg-[#ff4b5e]"
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
            <select
              className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm"
              onChange={(event) =>
                setForm((value) => ({ ...value, assetId: event.target.value }))
              }
              required
              value={form.assetId}
            >
              <option value="">Materiel</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
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
              className="bg-[#ff2f45] text-white hover:bg-[#ff4b5e] md:col-span-2"
              type="submit"
            >
              Enregistrer
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="h-11 border-white/10 bg-white/6 pl-11"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Rechercher par materiel, type, localisation ou motif..."
          value={searchQuery}
        />
      </div>

      <Card className="min-h-0 flex-1 border-white/10 bg-[#11183b]/95 text-white ring-0">
        <CardContent className="overflow-auto p-4">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                {["Materiel", "Type", "Depuis", "Vers", "Motif", "Date", "Actions"].map(
                  (head) => (
                    <TableHead className="text-slate-400" key={head}>
                      {head}
                    </TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.map((movement) => (
                <TableRow className="border-white/6 hover:bg-white/5" key={movement.id}>
                  <TableCell>{movement.asset}</TableCell>
                  <TableCell>{movement.type}</TableCell>
                  <TableCell>{movement.fromLocation}</TableCell>
                  <TableCell>{movement.toLocation}</TableCell>
                  <TableCell>{movement.reason}</TableCell>
                  <TableCell>{movement.movedAt}</TableCell>
                  <TableCell>
                    <Button
                      className="bg-[#ff2f45]/20 text-[#ff7a88] hover:bg-[#ff2f45]/30"
                      onClick={() => handleDelete(movement.id)}
                    >
                      Supprimer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
