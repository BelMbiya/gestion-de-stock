"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  filterKycAssets,
  formatKycAssetLabel,
  KYC_PROCO_COLUMNS,
  KYC_UI,
  type KycAssetOption,
} from "@/lib/kyc-excel/terminology";
import { ui } from "@/lib/ui-styles";

type AssetSearchSelectProps = {
  assets: KycAssetOption[];
  className?: string;
  disabled?: boolean;
  emptyLabel?: string;
  id?: string;
  label?: string;
  onValueChange: (assetId: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
};

export function AssetSearchSelect({
  assets,
  className,
  disabled = false,
  emptyLabel,
  id,
  label = KYC_UI.DESCRIPTION,
  onValueChange,
  placeholder = KYC_UI.SEARCH_PLACEHOLDER,
  required = false,
  value,
}: AssetSearchSelectProps) {
  const listId = useId();
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => assets.find((asset) => asset.id === value) ?? null,
    [assets, value],
  );

  const filtered = useMemo(
    () => filterKycAssets(assets, query).slice(0, 80),
    [assets, query],
  );

  useEffect(() => {
    if (!open) {
      setQuery(selected ? formatKycAssetLabel(selected) : "");
    }
  }, [open, selected]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function selectAsset(assetId: string) {
    onValueChange(assetId);
    setOpen(false);
  }

  function clearSelection() {
    onValueChange("");
    setQuery("");
    setOpen(false);
  }

  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      {label ? (
        <label className="text-xs text-slate-300" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <div className="relative" ref={rootRef}>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <Input
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          className={`${ui.input} pr-16 pl-9 text-sm text-white`}
          disabled={disabled}
          id={fieldId}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (!event.target.value.trim()) {
              onValueChange("");
            }
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          required={required && !value}
          role="combobox"
          value={query}
        />
        <div className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-0.5">
          {value ? (
            <Button
              aria-label="Effacer la selection"
              className="size-7 bg-transparent p-0 text-slate-400 hover:bg-white/10 hover:text-white"
              onClick={clearSelection}
              type="button"
            >
              <X className="size-3.5" />
            </Button>
          ) : null}
          <Button
            aria-label="Ouvrir la liste"
            className="size-7 bg-transparent p-0 text-slate-400 hover:bg-white/10 hover:text-white"
            onClick={() => setOpen((current) => !current)}
            type="button"
          >
            <ChevronDown className="size-4" />
          </Button>
        </div>

        {open ? (
          <ul
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-white/10 bg-slate-900 py-1 shadow-lg [scrollbar-gutter:stable]"
            id={listId}
            role="listbox"
          >
            {emptyLabel ? (
              <li>
                <button
                  className="w-full px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800"
                  onClick={() => selectAsset("")}
                  type="button"
                >
                  {emptyLabel}
                </button>
              </li>
            ) : null}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">{KYC_UI.NO_RESULTS}</li>
            ) : (
              filtered.map((asset) => {
                const isDisabled = asset.assignable === false;
                return (
                <li key={asset.id}>
                  <button
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-800 ${
                      asset.id === value ? "bg-slate-800/80 text-white" : "text-slate-200"
                    } ${isDisabled ? "cursor-not-allowed opacity-40 hover:bg-transparent" : ""}`}
                    disabled={isDisabled}
                    onClick={() => selectAsset(asset.id)}
                    role="option"
                    type="button"
                  >
                    <span className="font-mono text-xs text-slate-400">
                      {asset.sku ?? KYC_PROCO_COLUMNS.NO}
                    </span>
                    <span className="mt-0.5 block font-medium">{asset.name}</span>
                    {asset.serialNumber ? (
                      <span className="text-xs text-slate-500">
                        {KYC_UI.SERIAL_NUMBER}: {asset.serialNumber}
                      </span>
                    ) : null}
                    {asset.model ? (
                      <span className="text-xs text-slate-500">
                        {KYC_UI.MODEL}: {asset.model}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
              })
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
