import type { AppState, Chama, Contribution, Member, PublicBoardSnapshot } from './types';

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
    description: 'Weekly merry-go-round demo',
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

/** Payout order as member list (falls back to join order). */
export function membersInPayoutOrder(chama: Chama): Member[] {
  const order = chama.payoutOrder.length
    ? chama.payoutOrder
    : chama.members.map((m) => m.id);
  return order
    .map((id) => chama.members.find((m) => m.id === id))
    .filter((m): m is Member => Boolean(m));
}

/** Members who already received a merry-go-round payout in the current order round. */
export function payoutReceivedSet(chama: Chama): Set<string> {
  const n = membersInPayoutOrder(chama).length;
  if (n === 0) return new Set();
  // payouts are stored newest-first; chronological = oldest first
  const chronological = [...chama.payouts].reverse();
  const fullRounds = Math.floor(chronological.length / n);
  const thisRound = chronological.slice(fullRounds * n);
  return new Set(thisRound.map((p) => p.memberId));
}

export function nextPayoutMember(chama: Chama): Member | undefined {
  const paidOut = payoutReceivedSet(chama);
  const order = membersInPayoutOrder(chama);
  if (order.length === 0) return undefined;
  const next = order.find((m) => !paidOut.has(m.id));
  return next ?? order[0];
}

export function hasReceivedThisRound(chama: Chama, memberId: string): boolean {
  return payoutReceivedSet(chama).has(memberId);
}

export function movePayoutOrder(chama: Chama, memberId: string, dir: -1 | 1): Chama {
  const order = membersInPayoutOrder(chama).map((m) => m.id);
  const idx = order.indexOf(memberId);
  const j = idx + dir;
  if (idx < 0 || j < 0 || j >= order.length) return chama;
  const next = [...order];
  [next[idx], next[j]] = [next[j], next[idx]];
  return { ...chama, payoutOrder: next };
}

/** Skip current next person — move them after everyone still waiting. */
export function skipNextPayout(chama: Chama): Chama {
  const next = nextPayoutMember(chama);
  if (!next) return chama;
  const paidOut = payoutReceivedSet(chama);
  const order = membersInPayoutOrder(chama).map((m) => m.id);
  const waiting = order.filter((id) => !paidOut.has(id) && id !== next.id);
  const done = order.filter((id) => paidOut.has(id));
  // New order: already-received, remaining waiters, then skipped person
  const newOrder = [...done, ...waiting, next.id];
  // Preserve members not in order (shouldn't happen)
  for (const id of order) {
    if (!newOrder.includes(id)) newOrder.push(id);
  }
  return { ...chama, payoutOrder: newOrder };
}

export function swapPayoutOrder(chama: Chama, aId: string, bId: string): Chama {
  const order = membersInPayoutOrder(chama).map((m) => m.id);
  const i = order.indexOf(aId);
  const j = order.indexOf(bId);
  if (i < 0 || j < 0) return chama;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return { ...chama, payoutOrder: next };
}

export function unpaidMembers(chama: Chama): Member[] {
  return chama.members.filter(
    (m) => memberPaidInCycle(chama, m.id, chama.currentCycle) < chama.contributionAmount,
  );
}

/** Normalize KE-style phones to international digits for wa.me */
export function normalizePhoneForWhatsApp(phone: string): string | null {
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0') && digits.length >= 9) {
    digits = `254${digits.slice(1)}`;
  } else if (digits.startsWith('7') && digits.length === 9) {
    digits = `254${digits}`;
  } else if (digits.startsWith('1') && digits.length === 9) {
    digits = `254${digits}`;
  }
  return digits;
}

export function paymentReminderMessage(chama: Chama, memberName: string): string {
  const amount = money(chama.contributionAmount, chama.currency);
  const tillLine = chama.mpesaTill
    ? `\nLipa na M-Pesa Till: *${chama.mpesaTill}*`
    : '\n(Pay via cash / M-Pesa as agreed)';
  return (
    `Habari ${memberName} 👋\n\n` +
    `Reminder from *${chama.name}*:\n` +
    `Please pay *${amount}* for *Cycle ${chama.currentCycle}*.` +
    `${tillLine}\n\n` +
    `Asante! — via ChamaFlow`
  );
}

export function groupReminderMessage(chama: Chama, unpaid: Member[]): string {
  const amount = money(chama.contributionAmount, chama.currency);
  const names = unpaid.map((m) => `• ${m.name}`).join('\n');
  const tillLine = chama.mpesaTill ? `\nTill: *${chama.mpesaTill}*` : '';
  return (
    `*${chama.name}* — Cycle ${chama.currentCycle}\n\n` +
    `Pending contribution (*${amount}*):` +
    `\n${names || '• (none)'}` +
    `${tillLine}\n\n` +
    `Please pay so we can close the cycle. Asante 🙏`
  );
}

export function whatsappUrl(phone: string | null | undefined, message: string): string {
  const text = encodeURIComponent(message);
  if (phone) {
    const n = normalizePhoneForWhatsApp(phone);
    if (n) return `https://wa.me/${n}?text=${text}`;
  }
  // Opens WhatsApp with message only (user picks contact)
  return `https://wa.me/?text=${text}`;
}

// ─── Public cycle board (URL-encoded snapshot, no backend) ───

export function buildPublicBoard(chama: Chama): PublicBoardSnapshot {
  const next = nextPayoutMember(chama);
  const ordered = membersInPayoutOrder(chama);
  const orderIds = ordered.map((m) => m.id);
  // Include members not yet in order
  const rest = chama.members.filter((m) => !orderIds.includes(m.id));
  const all = [...ordered, ...rest];

  return {
    v: 1,
    name: chama.name,
    cycle: chama.currentCycle,
    amount: chama.contributionAmount,
    currency: chama.currency,
    till: chama.mpesaTill || '',
    nextName: next?.name ?? null,
    nextOrder: next ? orderIds.indexOf(next.id) + 1 : null,
    members: all.map((m) => {
      const paid = memberPaidInCycle(chama, m.id, chama.currentCycle);
      const ok = paid >= chama.contributionAmount;
      const order = orderIds.indexOf(m.id);
      return {
        name: m.name,
        paid,
        status: ok ? ('paid' as const) : ('pending' as const),
        order: order >= 0 ? order + 1 : 0,
        isNext: next?.id === m.id,
      };
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function encodeBoard(snapshot: PublicBoardSnapshot): string {
  const json = JSON.stringify(snapshot);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeBoard(token: string): PublicBoardSnapshot | null {
  try {
    let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = decodeURIComponent(escape(atob(b64)));
    const data = JSON.parse(json) as PublicBoardSnapshot;
    if (!data || data.v !== 1 || !data.name || !Array.isArray(data.members)) return null;
    return data;
  } catch {
    return null;
  }
}

export function publicBoardUrl(snapshot: PublicBoardSnapshot, origin = window.location.origin): string {
  const token = encodeBoard(snapshot);
  return `${origin}${window.location.pathname}#/board/${token}`;
}

export function parseHashRoute():
  | { type: 'app' }
  | { type: 'board'; token: string } {
  const h = window.location.hash.replace(/^#/, '');
  const m = h.match(/^\/?board\/(.+)$/);
  if (m?.[1]) return { type: 'board', token: decodeURIComponent(m[1]) };
  return { type: 'app' };
}
