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

export interface Chama {
  id: string;
  name: string;
  description: string;
  contributionAmount: number;
  currency: 'KES' | 'USD';
  cycleDay: number; // day of month expected
  currentCycle: number;
  mpesaTill: string;
  adminName: string;
  adminPhone: string;
  members: Member[];
  contributions: Contribution[];
  payouts: Payout[];
  fines: Fine[];
  payoutOrder: string[]; // member ids in merry-go-round order
  createdAt: string;
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
  members: PublicBoardMember[];
  updatedAt: string;
}

export type BoardMemberStatus = 'paid' | 'claimed' | 'pending';

export interface PublicBoardMember {
  name: string;
  paid: number;
  status: BoardMemberStatus;
  order: number;
  isNext: boolean;
}
