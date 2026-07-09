export interface Member {
  id: string;
  name: string;
  phone: string;
  joinedAt: string;
}

export interface Contribution {
  id: string;
  memberId: string;
  amount: number;
  date: string;
  note: string;
  cycle: number;
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
