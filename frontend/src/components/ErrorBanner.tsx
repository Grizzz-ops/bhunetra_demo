import { AlertOctagonIcon, RefreshIcon } from "./icons";

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-lg border p-3.5 text-sm"
      style={{ borderColor: "var(--violation)", background: "var(--violation-bg)", color: "var(--violation)" }}
    >
      <AlertOctagonIcon size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium leading-snug">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold border font-display uppercase tracking-wide active:scale-95 transition-transform"
          style={{ borderColor: "var(--violation)" }}
        >
          <RefreshIcon size={13} />
          Retry
        </button>
      )}
    </div>
  );
}
