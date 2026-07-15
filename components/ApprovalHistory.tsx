"use client";

import { ApprovalRecord } from "@/lib/approvals";

const ACTION_LABEL: Record<string, string> = {
  submit: "Submit",
  approve: "Approve",
  reject: "Tolak",
  post: "Posting",
  return_to_draft: "Kembali ke draft",
};

const ACTION_COLOR: Record<string, string> = {
  submit: "text-km-blue-ink",
  approve: "text-km-teal-ink",
  reject: "text-km-red-ink",
  post: "text-km-teal-ink",
  return_to_draft: "text-km-ink-muted",
};

export function ApprovalHistory({ record }: { record: ApprovalRecord }) {
  if (!record.history || record.history.length === 0) return null;

  return (
    <div className="rounded-xl border border-km-border bg-km-panel p-4">
      <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-km-ink-muted">
        Riwayat Approval
      </p>
      <ul className="space-y-1.5">
        {record.history.map((h, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px]">
            <span className={`min-w-12 font-medium ${ACTION_COLOR[h.action] ?? "text-km-ink"}`}>
              {ACTION_LABEL[h.action] ?? h.action}
            </span>
            <span className="flex-1">
              <span className="text-km-ink">{h.user_name ?? "—"}</span>
              {h.step !== undefined && h.step !== null && h.step > 0 && (
                <span className="ml-1.5 text-[10px] uppercase text-km-ink-muted">
                  step {h.step}
                  {h.step_name ? ` · ${h.step_name}` : ""}
                </span>
              )}
              {h.note && (
                <span className="ml-1.5 italic text-km-ink-soft">— {h.note}</span>
              )}
            </span>
            <span className="text-[11px] text-km-ink-muted whitespace-nowrap">
              {h.at.replace("T", " ").slice(0, 16)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
