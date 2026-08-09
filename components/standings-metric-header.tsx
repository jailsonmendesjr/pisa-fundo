"use client";

import { useId, useState } from "react";
import { Medal, Trophy } from "lucide-react";

interface StandingsMetricHeaderProps {
  label: string;
  metric: "wins" | "podiums";
}

export function StandingsMetricHeader({ label, metric }: StandingsMetricHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();
  const Icon = metric === "wins" ? Trophy : Medal;

  return (
    <>
      <span className="hidden md:inline">{label}</span>
      <span className="relative inline-flex md:hidden">
        <button
          type="button"
          aria-label={label}
          aria-describedby={isOpen ? tooltipId : undefined}
          aria-expanded={isOpen}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-amber-500 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          onClick={() => setIsOpen((open) => !open)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false);
              event.currentTarget.blur();
            }
          }}
        >
          <Icon aria-hidden="true" size={19} strokeWidth={2.25} />
        </button>
        {isOpen ? (
          <span
            id={tooltipId}
            role="tooltip"
            className="absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-semibold normal-case tracking-normal text-slate-950 shadow-lg"
          >
            {label}
            <span
              aria-hidden="true"
              className="absolute bottom-full left-1/2 -translate-x-1/2 border-x-4 border-b-4 border-x-transparent border-b-slate-100"
            />
          </span>
        ) : null}
      </span>
    </>
  );
}
