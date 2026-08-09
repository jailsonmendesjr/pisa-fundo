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
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(event) => setValue(event.target.value.toUpperCase())}
          className="h-10 w-12 cursor-pointer rounded-lg border border-slate-700 bg-slate-950 p-1"
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
          className={`min-w-0 flex-1 rounded-lg border bg-slate-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-amber-500 ${
            isFullHexColor(value) ? "border-slate-700" : "border-red-500/70"
          }`}
          placeholder="#000000"
        />
      </span>
      {!isFullHexColor(value) ? (
        <span className="block text-xs text-red-300">
          Valor legado inválido. Escolha ou informe uma cor no formato #RRGGBB.
        </span>
      ) : null}
    </label>
  );
}
