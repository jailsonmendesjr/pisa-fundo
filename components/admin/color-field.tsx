"use client";

import { useState } from "react";

type ColorFieldProps = {
  name: string;
  label: string;
  defaultValue: string;
};

const isFullHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

export function ColorField({ name, label, defaultValue }: ColorFieldProps) {
  const [value, setValue] = useState(defaultValue);
  const pickerValue = isFullHexColor(value) ? value : "#000000";

  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(event) => setValue(event.target.value.toUpperCase())}
          className="h-10 w-12 cursor-pointer rounded-md border border-slate-200 bg-white p-1 shadow-sm"
          aria-label={`Selecionar ${label.toLowerCase()}`}
        />
        <input
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
          maxLength={7}
          pattern="#[0-9a-fA-F]{6}"
          title="Use uma cor hexadecimal no formato #RRGGBB"
          className={`min-w-0 flex-1 rounded-md border bg-white px-3 py-2 font-mono text-sm text-slate-950 shadow-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/15 ${
            isFullHexColor(value) ? "border-slate-200" : "border-red-500"
          }`}
          placeholder="#000000"
        />
      </span>
      {!isFullHexColor(value) ? (
        <span className="block text-xs text-red-700">
          Valor legado inválido. Escolha ou informe uma cor no formato #RRGGBB.
        </span>
      ) : null}
    </label>
  );
}
