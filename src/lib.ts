import type { AppState, Chama, Contribution, Member } from './types';

const KEY = 'chamaflow_v1';

export function uid(p = 'id') {
  return `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function money(n: number, currency = 'KES') {
  try {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch {
    /* */
  }
  const seeded = seed();
  save(seeded);
  return seeded;
}

export function save(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function seed(): AppState {
  const m1: Member = { id: uid('m'), name: 'Amina Wanjiku', phone: '0712000001', joinedAt: today() };
  const m2: Member = { id: uid('m'), name: 'James Otieno', phone: '0712000002', joinedAt: today() };
  const m3: Member = { id: uid('m'), name: 'Grace Njeri', phone: '0712000003', joinedAt: today() };
  const members = [m1, m2, m3];
  const contributions: Contribution[] = [
    { id: uid('c'), memberId: m1.id, amount: 2000, date: today(), note: 'Cycle 1', cycle: 1 },
    { id: uid('c'), memberId: m2.id, amount: 2000, date: today(), note: 'Cycle 1', cycle: 1 },
  ];
  const chama: Chama = {
    id: uid('ch'),
    name: 'Umoja Sisters Chama',
    description: 'Weekly table banking demo',
    contributionAmount: 2000,
    currency: 'KES',
    cycleDay: 5,
    currentCycle: 1,
    mpesaTill: '123456',
    adminName: 'Demo Admin',
    adminPhone: '0700000000',
    members,
    contributions,
    payouts: [],
    fines: [],
    payoutOrder: members.map((m) => m.id),
    createdAt: new Date().toISOString(),
  };
  return { chamas: [chama], activeChamaId: chama.id };
}

export function memberPaidInCycle(chama: Chama, memberId: string, cycle: number) {
  return chama.contributions
    .filter((c) => c.memberId === memberId && c.cycle === cycle)
    .reduce((s, c) => s + c.amount, 0);
}

export function potTotal(chama: Chama) {
  const inAmt = chama.contributions.reduce((s, c) => s + c.amount, 0);
  const outAmt = chama.payouts.reduce((s, c) => s + c.amount, 0);
  const fines = chama.fines.filter((f) => f.paid).reduce((s, f) => s + f.amount, 0);
  return inAmt + fines - outAmt;
}

export function nextPayoutMember(chama: Chama): Member | undefined {
  const paidOut = new Set(chama.payouts.map((p) => p.memberId));
  const order = chama.payoutOrder.length
    ? chama.payoutOrder
    : chama.members.map((m) => m.id);
  const nextId = order.find((id) => !paidOut.has(id)) || order[chama.payouts.length % order.length];
  return chama.members.find((m) => m.id === nextId);
}
