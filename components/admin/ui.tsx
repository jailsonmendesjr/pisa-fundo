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
          ? "border-red-500/20 bg-red-500/10 text-red-300"
          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
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
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-500">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
        {title}
      </h1>
      <p className="max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
        {description}
      </p>
    </header>
  );
}

export const inputClassName =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10";

export const labelClassName =
  "block space-y-2 text-xs font-bold uppercase tracking-wide text-slate-400";

export const cardClassName =
  "rounded-2xl border border-slate-800 bg-slate-900/60 p-5";
