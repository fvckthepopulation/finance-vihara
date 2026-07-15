import { api } from "./api";

export type BankAccountLookup = {
  id: number;
  code: string; // COA code (104-XX)
  name: string;
  entity_id: number | null;
  entity?: { id: number; code: string; legal_name: string } | null;
};

// Bank accounts are derived from COA where parent_code = 104-00.
// Read-only lookup; manage via /admin/coa.
export const lookupBankAccounts = (params: { q?: string } = {}) => {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  return api<BankAccountLookup[]>(`/api/masters/bank-accounts${sp.toString() ? `?${sp}` : ""}`);
};
