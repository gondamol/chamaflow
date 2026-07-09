/** Daraja STK callback sink — log only for now (soft ledger still treasurer-confirmed). */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('[mpesa callback]', JSON.stringify(body).slice(0, 2000));
  } catch {
    /* ignore */
  }
  return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
