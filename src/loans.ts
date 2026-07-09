import type { Chama, Loan, LoanRepayment, Member } from './types';
import { potTotal, today, uid } from './lib';

export function activeLoans(chama: Chama): Loan[] {
  return (chama.loans || []).filter((l) => l.status === 'active');
}

export function loanBalance(loan: Loan): number {
  return Math.max(0, loan.totalDue - loan.repaid);
}

export function totalLoanOut(chama: Chama): number {
  return activeLoans(chama).reduce((s, l) => s + loanBalance(l), 0);
}

export function memberActiveLoans(chama: Chama, memberId: string): Loan[] {
  return activeLoans(chama).filter((l) => l.memberId === memberId);
}

export function calcInterest(principal: number, ratePercent: number): number {
  return Math.round(((principal * ratePercent) / 100) * 100) / 100;
}

export function issueLoan(
  chama: Chama,
  input: {
    memberId: string;
    principal: number;
    interestRate: number;
    dueDate: string;
    guarantorIds?: string[];
    note?: string;
  },
): { chama: Chama; error?: string; loan?: Loan } {
  if (!input.memberId) return { chama, error: 'Pick a member' };
  if (input.principal <= 0) return { chama, error: 'Enter principal amount' };
  const pot = potTotal(chama);
  if (input.principal > pot) {
    return { chama, error: `Pot only has enough for ${pot.toFixed(0)} — cannot lend ${input.principal}` };
  }

  const interestAmount = calcInterest(input.principal, input.interestRate);
  const loan: Loan = {
    id: uid('ln'),
    memberId: input.memberId,
    principal: input.principal,
    interestRate: input.interestRate,
    interestAmount,
    totalDue: input.principal + interestAmount,
    repaid: 0,
    issuedAt: today(),
    dueDate: input.dueDate || today(),
    guarantorIds: input.guarantorIds || [],
    note: input.note || 'Table banking loan',
    status: 'active',
    cycle: chama.currentCycle,
  };

  return {
    chama: { ...chama, loans: [loan, ...(chama.loans || [])] },
    loan,
  };
}

export function repayLoan(
  chama: Chama,
  input: {
    loanId: string;
    amount: number;
    mpesaCode?: string;
    note?: string;
  },
): { chama: Chama; error?: string } {
  const loan = (chama.loans || []).find((l) => l.id === input.loanId);
  if (!loan) return { chama, error: 'Loan not found' };
  if (loan.status !== 'active') return { chama, error: 'Loan is not active' };
  if (input.amount <= 0) return { chama, error: 'Enter repayment amount' };

  const bal = loanBalance(loan);
  const pay = Math.min(input.amount, bal);
  const repaid = loan.repaid + pay;
  const fullyPaid = repaid >= loan.totalDue - 0.001;

  const repayment: LoanRepayment = {
    id: uid('lr'),
    loanId: loan.id,
    memberId: loan.memberId,
    amount: pay,
    date: today(),
    mpesaCode: (input.mpesaCode || '').trim().toUpperCase(),
    note: input.note || '',
  };

  const loans = chama.loans.map((l) =>
    l.id === loan.id
      ? {
          ...l,
          repaid,
          status: fullyPaid ? ('repaid' as const) : ('active' as const),
        }
      : l,
  );

  return {
    chama: {
      ...chama,
      loans,
      loanRepayments: [repayment, ...(chama.loanRepayments || [])],
    },
  };
}

export function markLoanDefaulted(chama: Chama, loanId: string): Chama {
  return {
    ...chama,
    loans: (chama.loans || []).map((l) =>
      l.id === loanId && l.status === 'active' ? { ...l, status: 'defaulted' as const } : l,
    ),
  };
}

export function guarantorNames(chama: Chama, loan: Loan): string {
  if (!loan.guarantorIds?.length) return '—';
  return loan.guarantorIds
    .map((id) => chama.members.find((m) => m.id === id)?.name || id)
    .join(', ');
}

export function memberName(chama: Chama, memberId: string): string {
  return chama.members.find((m) => m.id === memberId)?.name || 'Member';
}

export function overdueLoans(chama: Chama, asOf = today()): Loan[] {
  return activeLoans(chama).filter((l) => l.dueDate && l.dueDate < asOf);
}

export function loanSummary(chama: Chama) {
  const active = activeLoans(chama);
  return {
    activeCount: active.length,
    outstanding: totalLoanOut(chama),
    overdueCount: overdueLoans(chama).length,
    repaidCount: (chama.loans || []).filter((l) => l.status === 'repaid').length,
  };
}

export function otherMembers(chama: Chama, memberId: string): Member[] {
  return chama.members.filter((m) => m.id !== memberId);
}
