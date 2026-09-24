"use client";

import { useState } from "react";
import type {
  CupParticipationMarker,
  CupParticipationState,
} from "@/lib/cup-participation";

type CupParticipationDotsProps = {
  markers: CupParticipationMarker[];
};

const dotStyles: Record<CupParticipationState, string> = {
  PARTICIPATED: "border-emerald-500 bg-emerald-500",
  MISSED: "border-red-400 bg-red-400",
  PENDING: "border-slate-300 bg-slate-300",
  NOT_ENROLLED: "border-slate-400 bg-white",
};

function getMarkerLabel(marker: CupParticipationMarker) {
  const prefix = `${marker.cupOrder}ª etapa`;

  if (marker.state === "PARTICIPATED") {
    return marker.resultStatus === "DNF"
      ? `${prefix} — Participou (abandono)`
      : `${prefix} — Participou`;
  }
  if (marker.state === "MISSED") {
    return marker.resultStatus === "DNS"
      ? `${prefix} — Não largou`
      : `${prefix} — Não participou`;
  }
  if (marker.state === "NOT_ENROLLED") {
    return `${prefix} — Ainda não estava inscrito`;
  }
  if (marker.roundId === null) {
    return `${prefix} — Ainda não cadastrada`;
  }
  return `${prefix} — Aguardando resultado`;
}

export function CupParticipationDots({ markers }: CupParticipationDotsProps) {
  const [activeOrder, setActiveOrder] = useState<number | null>(null);
  const activeMarker = markers.find(
    (marker) => marker.cupOrder === activeOrder
  );

  return (
    <div
      className="relative mt-1 inline-flex items-center gap-0.5"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setActiveOrder(null);
        }
      }}
    >
      {markers.map((marker) => {
        const label = getMarkerLabel(marker);
        const isActive = activeOrder === marker.cupOrder;

        return (
          <button
            key={marker.cupOrder}
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
            aria-label={label}
            aria-expanded={isActive}
            onClick={() =>
              setActiveOrder(isActive ? null : marker.cupOrder)
            }
          >
            <span
              className={`h-2.5 w-2.5 rounded-full border ${dotStyles[marker.state]}`}
              aria-hidden="true"
            />
          </button>
        );
      })}

      {activeMarker ? (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-lg"
        >
          {getMarkerLabel(activeMarker)}
        </span>
      ) : null}
    </div>
  );
}
