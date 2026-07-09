/**
 * Bank-agnostic payment partners.
 * Real Daraja STK uses server secrets via /api/mpesa/stk-push.
 * Without credentials the app runs STK demo mode (soft ledger culture).
 */

export type StkMode = 'live' | 'demo' | 'unavailable';

export interface StkPushRequest {
  phone: string;
  amount: number;
  accountRef?: string;
  description?: string;
  tillOrShortcode?: string;
}

export interface StkPushResult {
  ok: boolean;
  mode: StkMode;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  customerMessage?: string;
  error?: string;
  demo?: boolean;
}

/** Normalize KE MSISDN for Daraja (2547…). */
export function toMsisdn(phone: string): string | null {
  let d = phone.replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('0')) d = `254${d.slice(1)}`;
  else if (d.startsWith('7') && d.length === 9) d = `254${d}`;
  else if (d.startsWith('1') && d.length === 9) d = `254${d}`;
  if (!d.startsWith('254') || d.length < 12) return null;
  return d;
}

export function partnerLabel(partner: string): string {
  if (partner === 'mpesa_stk') return 'M-Pesa STK';
  if (partner === 'bank_label') return 'Bank Till / Paybill labels';
  return 'Manual / cash / M-Pesa P2P';
}

/**
 * Initiate STK. Hits /api/mpesa/stk-push when available;
 * otherwise simulates success for informal demos.
 */
export async function requestStkPush(req: StkPushRequest): Promise<StkPushResult> {
  const msisdn = toMsisdn(req.phone);
  if (!msisdn) {
    return { ok: false, mode: 'unavailable', error: 'Enter a valid Kenya phone (07… or 2547…)' };
  }
  if (req.amount < 1) {
    return { ok: false, mode: 'unavailable', error: 'Amount must be at least 1' };
  }

  try {
    const res = await fetch('/api/mpesa/stk-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: msisdn,
        amount: Math.round(req.amount),
        accountRef: req.accountRef || 'ChamaFlow',
        description: req.description || 'Chama contribution',
        tillOrShortcode: req.tillOrShortcode || '',
      }),
    });

    if (res.status === 404 || res.status === 501) {
      return demoStk(msisdn, req.amount);
    }

    const data = (await res.json()) as StkPushResult & { message?: string };
    if (!res.ok) {
      // Server may intentionally return demo
      if (data.demo || data.mode === 'demo') return demoStk(msisdn, req.amount, data.customerMessage);
      return {
        ok: false,
        mode: data.mode || 'unavailable',
        error: data.error || data.message || `STK failed (${res.status})`,
      };
    }
    return {
      ok: true,
      mode: data.mode || 'live',
      checkoutRequestId: data.checkoutRequestId,
      merchantRequestId: data.merchantRequestId,
      customerMessage: data.customerMessage || 'Check your phone for the M-Pesa prompt.',
      demo: data.demo,
    };
  } catch {
    return demoStk(msisdn, req.amount);
  }
}

function demoStk(msisdn: string, amount: number, msg?: string): StkPushResult {
  const id = `DEMO${Date.now().toString(36).toUpperCase()}`;
  return {
    ok: true,
    mode: 'demo',
    demo: true,
    checkoutRequestId: id,
    merchantRequestId: id,
    customerMessage:
      msg ||
      `Demo STK: would prompt ${msisdn} for KES ${amount}. No real charge — connect Daraja env on Vercel for live STK.`,
  };
}

export function paymentInstruction(chama: {
  mpesaTill?: string;
  mpesaPaybill?: string;
  mpesaAccountRef?: string;
  contributionAmount?: number;
  currency?: string;
  paymentPartner?: string;
}): string {
  const amount = chama.contributionAmount ?? 0;
  const lines: string[] = [];
  if (chama.mpesaTill) {
    lines.push(`Buy Goods Till: ${chama.mpesaTill}`);
  }
  if (chama.mpesaPaybill) {
    lines.push(
      `Paybill: ${chama.mpesaPaybill}` +
        (chama.mpesaAccountRef ? ` · Account: ${chama.mpesaAccountRef}` : ''),
    );
  }
  if (!lines.length) {
    lines.push('Pay cash or M-Pesa as your group agreed.');
  }
  lines.push(`Amount: ${amount} ${chama.currency || 'KES'}`);
  if (chama.paymentPartner === 'mpesa_stk') {
    lines.push('STK push available from treasurer dashboard when configured.');
  }
  return lines.join('\n');
}
