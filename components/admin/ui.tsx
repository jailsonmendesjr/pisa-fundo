type NoticeProps = {
  success?: string;
  error?: string;
};

export function Notice({ success, error }: NoticeProps) {
  if (!success && !error) return null;

  return (
    <div
      className={`rounded-xl border p-4 text-sm ${
        error
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {error ?? success}
    </div>
  );
}

type PageHeadingProps = {
  eyebrow?: string;
  title: string;
  description: string;
};

export function PageHeading({ eyebrow, title, description }: PageHeadingProps) {
  return (
    <header className="space-y-2">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
        {title}
      </h1>
      <p className="max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
        {description}
      </p>
    </header>
  );
}

export const inputClassName =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/15";

export const labelClassName =
  "block space-y-2 text-xs font-semibold uppercase tracking-wide text-slate-600";

export const cardClassName =
  "rounded-lg border border-slate-200 bg-white p-5 shadow-sm";
