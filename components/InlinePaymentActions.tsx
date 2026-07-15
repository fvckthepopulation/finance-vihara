"use client";

import { useEffect, useState } from "react";
import {
  approveApproval,
  ApprovalResourceType,
  ApprovalState,
  getApproval,
  submitApproval,
} from "@/lib/approvals";
import { useAuth } from "@/lib/useAuth";
import { Button } from "./Button";

/**
 * Compact inline approval actions for payment rows (AP / AR).
 *
 * Payments follow the same two-step workflow as invoices (Input → Approve & Pay),
 * so the button depends on the *approval state*, not just the payment row status:
 *  - draft + submit perm           → "Submit" (hand off to approver)
 *  - draft + submit AND approve perm → "Approve" (submit + approve in one click)
 *  - submitted + approve perm      → "Approve" (approve only; the input already submitted)
 *
 * Designed to fit in a table cell.
 */
export function InlinePaymentActions({
  resourceType,
  resourceId,
  status,
  submitPerm,
  approvePerm,
  onChanged,
}: {
  resourceType: ApprovalResourceType;
  resourceId: number;
  status: "draft" | "posted";
  submitPerm: string;
  approvePerm: string;
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const [state, setState] = useState<ApprovalState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getApproval(resourceType, resourceId)
      .then((d) => {
        if (active) setState(d.record.state);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [resourceType, resourceId]);

  if (status === "posted") return null;

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setPending(true);
    try {
      await fn();
      // Refresh local approval state so the button reflects the new state
      // without waiting for a full page reload.
      const d = await getApproval(resourceType, resourceId).catch(() => null);
      if (d) setState(d.record.state);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setPending(false);
    }
  }

  const isDraft = state === "draft";
  const isSubmitted = state === "submitted";

  // Approver acting on a payment the input already submitted.
  const showApprove = isSubmitted && can(approvePerm);
  // A user holding both perms can submit + approve a fresh draft in one click.
  const showSubmitApprove = isDraft && can(submitPerm) && can(approvePerm);
  // Input submits a fresh draft for approval.
  const showSubmit = isDraft && can(submitPerm) && !showSubmitApprove;

  return (
    <div className="flex items-center gap-1.5">
      {showApprove && (
        <Button
          variant="success"
          size="sm"
          onClick={() => run(() => approveApproval(resourceType, resourceId))}
          disabled={pending}
        >
          {pending ? "…" : "Approve"}
        </Button>
      )}
      {showSubmitApprove && (
        <Button
          variant="success"
          size="sm"
          title="Submit + Approve sekaligus"
          onClick={() =>
            run(async () => {
              await submitApproval(resourceType, resourceId);
              await approveApproval(resourceType, resourceId);
            })
          }
          disabled={pending}
        >
          {pending ? "…" : "Approve"}
        </Button>
      )}
      {showSubmit && (
        <Button
          variant="primary"
          size="sm"
          onClick={() => run(() => submitApproval(resourceType, resourceId))}
          disabled={pending}
        >
          {pending ? "…" : "Submit"}
        </Button>
      )}
      {error && <span className="text-[10px] text-km-red-ink">{error}</span>}
    </div>
  );
}
