/**
 * Vercel serverless: Safaricom Daraja STK Push.
 * Secrets via env only (never VITE_*).
 * Without credentials → demo mode JSON.
 */

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function configured() {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY &&
      process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_SHORTCODE &&
      process.env.MPESA_PASSKEY,
  );
}

async function getToken(base, key, secret) {
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Token failed: ${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error('No access_token');
  return data.access_token;
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON', mode: 'unavailable' });
  }

  const phone = String(body.phone || '').replace(/\D/g, '');
  const amount = Math.round(Number(body.amount) || 0);
  if (!phone || amount < 1) {
    return json(400, { ok: false, error: 'phone and amount required', mode: 'unavailable' });
  }

  if (!configured()) {
    return json(200, {
      ok: true,
      mode: 'demo',
      demo: true,
      checkoutRequestId: `DEMO${Date.now()}`,
      merchantRequestId: `DEMO${Date.now()}`,
      customerMessage:
        'Demo STK (Daraja not configured). Set MPESA_* env on Vercel for live prompts.',
    });
  }

  const env = process.env.MPESA_ENV === 'production' ? 'production' : 'sandbox';
  const base =
    env === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

  try {
    const token = await getToken(
      base,
      process.env.MPESA_CONSUMER_KEY,
      process.env.MPESA_CONSUMER_SECRET,
    );
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const ts = timestamp();
    const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString('base64');
    const callback =
      process.env.MPESA_CALLBACK_URL ||
      `${new URL(request.url).origin}/api/mpesa/callback`;

    const res = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phone,
        PartyB: body.tillOrShortcode || shortcode,
        PhoneNumber: phone,
        CallBackURL: callback,
        AccountReference: String(body.accountRef || 'ChamaFlow').slice(0, 12),
        TransactionDesc: String(body.description || 'Chama contribution').slice(0, 13),
      }),
    });

    const data = await res.json();
    if (!res.ok || data.ResponseCode !== '0') {
      return json(502, {
        ok: false,
        mode: 'live',
        error: data.errorMessage || data.ResponseDescription || 'STK rejected',
      });
    }

    return json(200, {
      ok: true,
      mode: 'live',
      checkoutRequestId: data.CheckoutRequestID,
      merchantRequestId: data.MerchantRequestID,
      customerMessage: data.CustomerMessage || 'Check your phone for M-Pesa PIN prompt.',
    });
  } catch (e) {
    return json(500, {
      ok: false,
      mode: 'live',
      error: e instanceof Error ? e.message : 'STK error',
    });
  }
}
