"use client";

import { ApprovalRecord, ApprovalWorkflow } from "@/lib/approvals";

type Props = {
  record: ApprovalRecord;
  workflow: ApprovalWorkflow | null;
};

export function ApprovalBar({ record, workflow }: Props) {
  if (!workflow) {
    return (
      <div className="rounded-lg border border-km-border bg-km-panel-soft px-4 py-2.5 text-[12px] text-km-ink-muted">
        Belum ada workflow aktif untuk resource ini.
      </div>
    );
  }

  const steps = workflow.steps;
  const cs = record.current_step;
  const rejected = record.state === "rejected";

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-km-border bg-km-panel-soft px-4 py-2.5 text-[12px] flex-wrap">
      <span className="mr-1 font-medium text-km-ink-soft">Alur:</span>
      {steps.map((step, i) => {
        const order = step.order;
        let kind: "done" | "active" | "idle" | "rejected" = "idle";
        if (rejected) {
          kind = i === 0 ? "rejected" : "idle";
        } else if (record.state === "posted") {
          kind = "done";
        } else if (record.state === "submitted") {
          if (order < cs) kind = "done";
          else if (order === cs) kind = "active";
          else kind = "idle";
        } else if (record.state === "draft") {
          kind = "idle";
        }
        return (
          <span key={order} className="flex items-center gap-1.5">
            <span className={dotClass(kind)}>{order}</span>
            <span
              className={
                kind === "active"
                  ? "font-medium text-km-blue-ink"
                  : kind === "done"
                    ? "text-km-teal-ink"
                    : kind === "rejected"
                      ? "text-km-red-ink"
                      : "text-km-ink-muted"
              }
            >
              {step.name}
            </span>
            {i < steps.length - 1 && <span className="px-0.5 text-km-ink-muted">›</span>}
          </span>
        );
      })}
      <span className="ml-auto text-[11px] uppercase tracking-wider text-km-ink-muted">
        State: <span className={stateColor(record.state)}>{stateLabel(record.state)}</span>
      </span>
    </div>
  );
}

function dotClass(kind: "done" | "active" | "idle" | "rejected"): string {
  const base = "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold flex-shrink-0";
  switch (kind) {
    case "done":
      return `${base} bg-km-teal-soft text-km-teal-ink`;
    case "active":
      return `${base} bg-km-blue-soft text-km-blue-ink ring-2 ring-km-blue/30`;
    case "rejected":
      return `${base} bg-km-red-soft text-km-red-ink`;
    case "idle":
    default:
      return `${base} bg-km-panel text-km-ink-muted border border-km-border-strong`;
  }
}

function stateLabel(s: ApprovalRecord["state"]): string {
  return {
    draft: "Draft",
    submitted: "Menunggu Approval",
    approved: "Disetujui",
    posted: "Terbit",
    rejected: "Ditolak",
  }[s];
}

function stateColor(s: ApprovalRecord["state"]): string {
  return {
    draft: "text-km-ink-muted",
    submitted: "text-km-blue-ink",
    approved: "text-km-teal-ink",
    posted: "text-km-teal-ink",
    rejected: "text-km-red-ink",
  }[s];
}
