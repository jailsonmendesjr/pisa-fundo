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
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-red-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          onClick={() => setIsOpen((open) => !open)}
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
            className="absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium normal-case tracking-normal text-white shadow-lg"
          >
            {label}
          </span>
        ) : null}
      </span>
    </>
  );
}
