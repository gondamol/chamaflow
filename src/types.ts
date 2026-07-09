export interface Member {
  id: string;
  name: string;
  phone: string;
  joinedAt: string;
}

/** confirmed = treasurer verified (counts in pot). claimed = "Nililipa!" awaiting check. */
export type ContributionStatus = 'confirmed' | 'claimed' | 'rejected';

export interface Contribution {
  id: string;
  memberId: string;
  amount: number;
  date: string;
  note: string;
  cycle: number;
  /** Defaults to confirmed for legacy records. */
  status: ContributionStatus;
  /** M-Pesa confirmation code when available */
  mpesaCode: string;
  /** When a claim was confirmed or rejected */
  resolvedAt?: string;
  resolveNote?: string;
}

export interface Payout {
  id: string;
  memberId: string;
  amount: number;
  date: string;
  cycle: number;
  note: string;
}

export interface Fine {
  id: string;
  memberId: string;
  amount: number;
  date: string;
  reason: string;
  paid: boolean;
}

/** How often the group meets / advances the merry-go-round. */
export type CycleFrequency = 'weekly' | 'biweekly' | 'monthly';

/** Group operating mode — hybrid is most Kenyan chamas. */
export type ChamaMode = 'mgr' | 'table' | 'hybrid' | 'welfare';

export type LoanStatus = 'active' | 'repaid' | 'defaulted';

export interface Loan {
  id: string;
  memberId: string;
  principal: number;
  /** Interest as percent of principal (e.g. 10 = 10%) */
  interestRate: number;
  interestAmount: number;
  totalDue: number;
  repaid: number;
  issuedAt: string;
  dueDate: string;
  guarantorIds: string[];
  note: string;
  status: LoanStatus;
  cycle: number;
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  memberId: string;
  amount: number;
  date: string;
  mpesaCode: string;
  note: string;
}

/** Payment rail preference — bank-agnostic progressive formalisation. */
export type PaymentPartner = 'manual' | 'mpesa_stk' | 'bank_label';

export interface Chama {
  id: string;
  name: string;
  description: string;
  contributionAmount: number;
  currency: 'KES' | 'USD';
  cycleDay: number; // day of month expected (monthly mode)
  /** Meeting cadence for the MGR calendar */
  cycleFrequency: CycleFrequency;
  /** Next contribution / payout meeting (YYYY-MM-DD) */
  nextMeetingDate: string;
  currentCycle: number;
  /** Buy Goods Till (or Till label) */
  mpesaTill: string;
  /** Optional Paybill number */
  mpesaPaybill: string;
  /** Account / chama ref for Paybill */
  mpesaAccountRef: string;
  paymentPartner: PaymentPartner;
  mode: ChamaMode;
  adminName: string;
  adminPhone: string;
  members: Member[];
  contributions: Contribution[];
  payouts: Payout[];
  fines: Fine[];
  loans: Loan[];
  loanRepayments: LoanRepayment[];
  payoutOrder: string[]; // member ids in merry-go-round order
  createdAt: string;
  /** Cloud multi-device share code (Supabase). Null = local only. */
  cloudShareCode: string | null;
  cloudSyncedAt: string | null;
  /** Optimistic concurrency for cloud push */
  cloudRev: number;
}

/** One row on the merry-go-round calendar. */
export interface CalendarSlot {
  index: number;
  memberId: string;
  memberName: string;
  expectedDate: string;
  status: 'received' | 'next' | 'upcoming';
  label: string;
}

export interface AppState {
  chamas: Chama[];
  activeChamaId: string | null;
}

/** Read-only snapshot encoded into a share link (no backend). */
export interface PublicBoardSnapshot {
  v: 1;
  name: string;
  cycle: number;
  amount: number;
  currency: string;
  till: string;
  nextName: string | null;
  nextOrder: number | null;
  /** Compact upcoming payouts for the share link */
  upcoming?: { name: string; date: string; isNext: boolean }[];
  members: PublicBoardMember[];
  updatedAt: string;
  /** Optional live cloud code if group uses multi-device */
  liveCode?: string | null;
}

export type BoardMemberStatus = 'paid' | 'claimed' | 'pending';

export interface PublicBoardMember {
  name: string;
  paid: number;
  status: BoardMemberStatus;
  order: number;
  isNext: boolean;
}
