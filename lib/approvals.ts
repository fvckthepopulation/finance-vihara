import { api } from "./api";

export type ApprovalState = "draft" | "submitted" | "approved" | "posted" | "rejected";

export type ApprovalStep = {
  order: number;
  name: string;
  required_permission: string;
};

export type ApprovalWorkflow = {
  id: number;
  resource_type: string;
  name: string;
  steps: ApprovalStep[];
  active: boolean;
};

export type ApprovalHistoryEntry = {
  at: string;
  action: "submit" | "approve" | "reject" | "post" | "return_to_draft";
  step?: number;
  step_name?: string;
  user_id?: number;
  user_name?: string;
  note?: string;
};

export type ApprovalRecord = {
  id: number;
  resource_type: string;
  resource_id: number;
  workflow_id: number | null;
  current_step: number;
  state: ApprovalState;
  submitted_at: string | null;
  submitted_by_user_id: number | null;
  approved_at: string | null;
  approved_by_user_id: number | null;
  posted_at: string | null;
  posted_by_user_id: number | null;
  rejected_at: string | null;
  rejected_by_user_id: number | null;
  reject_reason: string | null;
  history: ApprovalHistoryEntry[];
};

export type ApprovalResourceType =
  | "ap_invoice"
  | "ar_invoice"
  | "ap_payment"
  | "ar_payment"
  | "petty_cash"
  | "manual_journal";

export const getApproval = (resourceType: ApprovalResourceType, id: number | string) =>
  api<{ record: ApprovalRecord; workflow: ApprovalWorkflow | null }>(
    `/api/approvals/${resourceType}/${id}`,
  );

export const submitApproval = (
  resourceType: ApprovalResourceType,
  id: number | string,
  note?: string,
) =>
  api<ApprovalRecord>(`/api/approvals/${resourceType}/${id}/submit`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });

export const approveApproval = (
  resourceType: ApprovalResourceType,
  id: number | string,
  note?: string,
) =>
  api<ApprovalRecord>(`/api/approvals/${resourceType}/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });

export const rejectApproval = (
  resourceType: ApprovalResourceType,
  id: number | string,
  reason: string,
) =>
  api<ApprovalRecord>(`/api/approvals/${resourceType}/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

export const returnApprovalToDraft = (
  resourceType: ApprovalResourceType,
  id: number | string,
) =>
  api<ApprovalRecord>(`/api/approvals/${resourceType}/${id}/return-to-draft`, {
    method: "POST",
  });

export const listWorkflows = () =>
  api<ApprovalWorkflow[]>(`/api/approvals/workflows`);
