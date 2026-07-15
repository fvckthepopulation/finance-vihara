import { api } from "./api";

export type PeriodMonth = {
  month: number;
  status: "open" | "closed";
  closed_at: string | null;
  closed_by: string | null;
  closing_notes: string | null;
};

export type PeriodMatrixRow = {
  entity_id: number;
  entity_code: string;
  entity_name: string;
  months: PeriodMonth[];
};

export type PeriodMatrix = {
  year: number;
  rows: PeriodMatrixRow[];
};

export type ChecklistItem = {
  key: string;
  label: string;
  count: number;
  pass: boolean;
  severity?: "warn";
};

export type ClosingChecklist = {
  entity_id: number;
  year: number;
  month: number;
  current_status: "open" | "closed";
  checks: ChecklistItem[];
  blocking_count: number;
};

export const getPeriods = (year: number) =>
  api<PeriodMatrix>(`/api/periods?year=${year}`);

export const getChecklist = (entityId: number, year: number, month: number) =>
  api<ClosingChecklist>(`/api/periods/${entityId}/${year}/${month}/checklist`);

export const closePeriod = (
  entityId: number,
  year: number,
  month: number,
  payload: { notes?: string; force?: boolean } = {},
) =>
  api<{ id: number; status: string }>(
    `/api/periods/${entityId}/${year}/${month}/close`,
    { method: "POST", body: JSON.stringify(payload) },
  );

export const reopenPeriod = (entityId: number, year: number, month: number) =>
  api<{ id: number; status: string }>(
    `/api/periods/${entityId}/${year}/${month}/reopen`,
    { method: "POST" },
  );

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];
