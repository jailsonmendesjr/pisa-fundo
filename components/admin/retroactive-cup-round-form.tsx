"use client";

import { useMemo, useState } from "react";
import { addRetroactiveCupRound } from "@/app/admin/actions";
import { SubmitButton } from "@/components/admin/submit-button";
import { inputClassName, labelClassName } from "@/components/admin/ui";

type RetroactiveRound = {
  id: number;
  name: string;
  date: string;
};

type EligibleEntry = {
  id: number;
  driverName: string;
  teamName: string;
};

type OfficialResult = {
  entryId: number;
  roundId: number;
  points: number;
  position: number;
  status: string;
};

type RetroactiveCupRoundFormProps = {
  cupId: number;
  rounds: RetroactiveRound[];
  availableOrders: number[];
  entries: EligibleEntry[];
  results: OfficialResult[];
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00Z`));
}

function resultLabel(result?: OfficialResult) {
  if (!result) return "Sem resultado nesta etapa · 0 ponto";
  if (result.status === "COMPLETED") {
    return `${result.position}º lugar · ${result.points} ponto${result.points === 1 ? "" : "s"}`;
  }
  return `${result.status} · ${result.points} ponto${result.points === 1 ? "" : "s"}`;
}

export function RetroactiveCupRoundForm({
  cupId,
  rounds,
  availableOrders,
  entries,
  results,
}: RetroactiveCupRoundFormProps) {
  const [roundId, setRoundId] = useState(String(rounds[0]?.id ?? ""));
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
  const resultByEntryId = useMemo(
    () =>
      new Map(
        results
          .filter((result) => result.roundId === Number(roundId))
          .map((result) => [result.entryId, result])
      ),
    [results, roundId]
  );
  const selectedResults = selectedEntryIds.map((entryId) =>
    resultByEntryId.get(entryId)
  );
  const selectedPoints = selectedResults.reduce(
    (total, result) => total + (result?.points ?? 0),
    0
  );

  return (
    <form
      action={addRetroactiveCupRound}
      className="space-y-5 rounded-lg border border-amber-300 bg-amber-50/60 p-5"
    >
      <input type="hidden" name="cup_id" value={cupId} />
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
          Inclusão excepcional
        </p>
        <h3 className="mt-1 text-base font-black text-slate-950">
          Incluir etapa já realizada
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          O resultado oficial não será alterado. Selecione somente pilotos que já
          estavam confirmados para a Copa antes da divulgação do resultado.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_140px]">
        <label className={labelClassName}>
          Etapa com resultado publicado
          <select
            name="round_id"
            required
            value={roundId}
            onChange={(event) => {
              setRoundId(event.target.value);
              setSelectedEntryIds([]);
            }}
            className={inputClassName}
          >
            {rounds.map((round) => (
              <option key={round.id} value={round.id}>
                {round.name} · {formatDate(round.date)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClassName}>
          Ordem na Copa
          <select name="cup_order" required className={inputClassName}>
            {availableOrders.map((order) => (
              <option key={order} value={order}>
                {order}ª etapa
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Pilotos confirmados antes da corrida
        </legend>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {entries.map((entry) => {
            const checked = selectedEntryIds.includes(entry.id);
            const result = resultByEntryId.get(entry.id);
            return (
              <label
                key={entry.id}
                className={`flex cursor-pointer gap-3 rounded-md border p-3 text-sm transition ${
                  checked
                    ? "border-red-300 bg-white"
                    : "border-slate-200 bg-white/70 hover:border-slate-300"
                }`}
              >
                <input
                  type="checkbox"
                  name="entry_id"
                  value={entry.id}
                  checked={checked}
                  onChange={(event) => {
                    setSelectedEntryIds((current) =>
                      event.target.checked
                        ? [...current, entry.id]
                        : current.filter((id) => id !== entry.id)
                    );
                  }}
                  className="mt-1 h-4 w-4 accent-red-600"
                />
                <span>
                  <span className="block font-bold text-slate-900">
                    {entry.driverName}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {entry.teamName} · {resultLabel(result)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <strong>{selectedEntryIds.length} piloto{selectedEntryIds.length === 1 ? "" : "s"}</strong>
        {" · "}
        {selectedPoints} ponto{selectedPoints === 1 ? "" : "s"} já publicados serão
        considerados nesta etapa da Copa. Pilotos sem resultado permanecem com zero.
      </div>

      <label className={labelClassName}>
        Justificativa da inclusão
        <textarea
          name="reason"
          required
          minLength={10}
          maxLength={300}
          rows={3}
          className={inputClassName}
          placeholder="Ex.: pilotos confirmados antes da etapa realizada em 22/09/2026."
        />
      </label>

      <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
        <input
          type="checkbox"
          name="confirmed"
          value="true"
          required
          className="mt-1 h-4 w-4 accent-red-600"
        />
        Confirmo que os pilotos selecionados já participariam da Copa antes da
        divulgação do resultado desta etapa.
      </label>

      <SubmitButton pendingLabel="Incluindo etapa...">
        Confirmar inclusão retroativa
      </SubmitButton>
    </form>
  );
}
