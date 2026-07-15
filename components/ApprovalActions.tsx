"use client";

import { useEffect, useState } from "react";
import {
  ApprovalRecord,
  ApprovalResourceType,
  ApprovalWorkflow,
  approveApproval,
  getApproval,
  rejectApproval,
  returnApprovalToDraft,
  submitApproval,
} from "@/lib/approvals";
import { useAuth } from "@/lib/useAuth";
import { Button } from "./Button";

type Props = {
  resourceType: ApprovalResourceType;
  resourceId: number;
  onChanged?: (rec: ApprovalRecord) => void;
  /** Sembunyikan tombol "Submit untuk Approval" (submit dilakukan dari halaman lain). */
  hideSubmit?: boolean;
};

export function ApprovalActions({ resourceType, resourceId, onChanged, hideSubmit }: Props) {
  const { can, loading: authLoading } = useAuth();
  const [record, setRecord] = useState<ApprovalRecord | null>(null);
  const [workflow, setWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  function load() {
    getApproval(resourceType, resourceId)
      .then((d) => {
        setRecord(d.record);
        setWorkflow(d.workflow);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat approval"));
  }

  useEffect(() => {
    load();
  }, [resourceType, resourceId]);

  async function act(action: string, fn: () => Promise<ApprovalRecord>) {
    setPending(action);
    setError(null);
    try {
      const rec = await fn();
      setRecord(rec);
      onChanged?.(rec);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setPending(null);
    }
  }

  if (authLoading || !record || !workflow) return null;

  const isDraft = record.state === "draft";
  const isSubmitted = record.state === "submitted";
  const isRejected = record.state === "rejected";
  const isPosted = record.state === "posted";

  const currentStepPermission = workflow.steps.find(
    (s) => s.order === record.current_step,
  )?.required_permission;
  const submitPermission = workflow.steps[0]?.required_permission;

  const canSubmit = !hideSubmit && isDraft && submitPermission ? can(submitPermission) : false;
  const canApprove =
    isSubmitted && currentStepPermission ? can(currentStepPermission) : false;
  const canReject = canApprove;
  const canReturnToDraft = isRejected && submitPermission ? can(submitPermission) : false;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && (
        <p className="w-full rounded-lg border border-km-red bg-km-red-soft px-3 py-1.5 text-[11px] text-km-red-ink">
          {error}
        </p>
      )}

      {canSubmit && (
        <Button
          variant="primary"
          disabled={pending !== null}
          onClick={() => act("submit", () => submitApproval(resourceType, resourceId))}
        >
          {pending === "submit" ? "Mengirim…" : "Submit untuk Approval"}
        </Button>
      )}

      {canApprove && !showRejectForm && (
        <>
          <Button
            variant="success"
            disabled={pending !== null}
            onClick={() => act("approve", () => approveApproval(resourceType, resourceId))}
          >
            {pending === "approve" ? "Memproses…" : "Approve & Post"}
          </Button>
          {canReject && (
            <Button variant="danger" onClick={() => setShowRejectForm(true)}>
              Tolak
            </Button>
          )}
        </>
      )}

      {showRejectForm && (
        <div className="flex w-full flex-col gap-2 rounded-lg border border-km-red bg-km-red-soft p-3">
          <p className="text-[11px] font-medium text-km-red-ink">Alasan penolakan</p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Jelaskan kenapa ditolak…"
            className="min-h-[60px] w-full rounded-md border border-km-border-strong bg-km-panel px-2 py-1.5 text-[12px]"
          />
          <div className="flex gap-2">
            <Button
              variant="danger"
              disabled={!rejectReason.trim() || pending !== null}
              onClick={() =>
                act("reject", async () => {
                  const r = await rejectApproval(resourceType, resourceId, rejectReason.trim());
                  setShowRejectForm(false);
                  setRejectReason("");
                  return r;
                })
              }
            >
              {pending === "reject" ? "Menolak…" : "Konfirmasi Tolak"}
            </Button>
            <Button variant="default" onClick={() => setShowRejectForm(false)}>
              Batal
            </Button>
          </div>
        </div>
      )}

      {canReturnToDraft && (
        <Button
          variant="default"
          disabled={pending !== null}
          onClick={() =>
            act("return", () => returnApprovalToDraft(resourceType, resourceId))
          }
        >
          {pending === "return" ? "…" : "Kembalikan ke Draft"}
        </Button>
      )}

      {isPosted && (
        <span className="text-[12px] text-km-teal-ink">✓ Sudah diposting ke jurnal</span>
      )}

      {isRejected && record.reject_reason && (
        <p className="w-full text-[11px] text-km-red-ink">
          Ditolak: <span className="font-medium">{record.reject_reason}</span>
        </p>
      )}
    </div>
  );
}
