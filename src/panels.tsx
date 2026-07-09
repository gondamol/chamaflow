import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Download,
  Upload,
  Copy,
  Check,
  Landmark,
  HandCoins,
  Smartphone,
  MessageCircle,
} from 'lucide-react';
import type { Chama, PaymentPartner } from './types';
import {
  money,
  potTotal,
  today,
  whatsappUrl,
} from './lib';
import {
  cloudStatusLabel,
  isCloudConfigured,
  liveBoardUrl,
  pullChamaFromCloud,
  pushChamaToCloud,
  subscribeCloudChama,
} from './cloud';
import {
  activeLoans,
  guarantorNames,
  issueLoan,
  loanBalance,
  loanSummary,
  markLoanDefaulted,
  memberName,
  otherMembers,
  repayLoan,
} from './loans';
import { partnerLabel, paymentInstruction, requestStkPush, toMsisdn } from './mpesa';

type Updater = (id: string, fn: (c: Chama) => Chama) => void;

/* ─── Cloud multi-device ─── */

export function CloudSyncPanel({
  chama,
  onUpdate,
  onImportChama,
  setFlash,
}: {
  chama: Chama;
  onUpdate: Updater;
  onImportChama: (c: Chama) => void;
  setFlash: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const configured = isCloudConfigured();

  useEffect(() => {
    if (!chama.cloudShareCode || !configured) return;
    return subscribeCloudChama(chama.cloudShareCode, (remote) => {
      if ((remote.cloudRev || 0) > (chama.cloudRev || 0)) {
        onUpdate(chama.id, () => ({ ...remote, id: chama.id }));
        setFlash('Cloud update received from another device.');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chama.cloudShareCode, chama.cloudRev, configured]);

  const push = async () => {
    setBusy(true);
    const res = await pushChamaToCloud(chama);
    setBusy(false);
    if (!res.ok) {
      setFlash(res.error);
      return;
    }
    onUpdate(chama.id, (c) => ({
      ...c,
      cloudShareCode: res.shareCode,
      cloudRev: res.rev,
      cloudSyncedAt: new Date().toISOString(),
    }));
    setFlash(`Synced to cloud. Share code: ${res.shareCode}`);
  };

  const pull = async () => {
    const code = (chama.cloudShareCode || joinCode).trim();
    if (!code) return setFlash('Enter a share code first.');
    setBusy(true);
    const res = await pullChamaFromCloud(code);
    setBusy(false);
    if (!res.ok) {
      setFlash(res.error);
      return;
    }
    onUpdate(chama.id, () => ({ ...res.chama, id: chama.id }));
    setFlash(`Pulled latest (rev ${res.rev}).`);
  };

  const joinAsDevice = async () => {
    if (!joinCode.trim()) return;
    setBusy(true);
    const res = await pullChamaFromCloud(joinCode);
    setBusy(false);
    if (!res.ok) {
      setFlash(res.error);
      return;
    }
    onImportChama(res.chama);
    setFlash(`Joined ${res.chama.name} as multi-device (code ${joinCode.toUpperCase()}).`);
  };

  const copyCode = async () => {
    if (!chama.cloudShareCode) return;
    try {
      await navigator.clipboard.writeText(chama.cloudShareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Share code:', chama.cloudShareCode);
    }
  };

  const copyLive = async () => {
    if (!chama.cloudShareCode) return;
    const url = liveBoardUrl(chama.cloudShareCode);
    try {
      await navigator.clipboard.writeText(url);
      setFlash('Live board link copied — updates when you push.');
    } catch {
      prompt('Live board:', url);
    }
  };

  return (
    <div className="card cloud-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            {configured ? <Cloud size={18} /> : <CloudOff size={18} />} Multi-device cloud
          </h3>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            Treasurer + secretary on different phones. {cloudStatusLabel()}.
          </p>
        </div>
        {chama.cloudShareCode ? (
          <span className="badge badge-ok">Code {chama.cloudShareCode}</span>
        ) : (
          <span className="badge">Local only</span>
        )}
      </div>

      {!configured ? (
        <p className="claim-hint" style={{ marginTop: '0.75rem' }}>
          Set <code>VITE_SUPABASE_URL</code> + <code>VITE_SUPABASE_ANON_KEY</code>, run{' '}
          <code>supabase/schema.sql</code>, redeploy. Soft ledger still works offline.
        </p>
      ) : null}

      <div className="toolbar" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || !configured} onClick={push}>
          <Upload size={14} /> {chama.cloudShareCode ? 'Push update' : 'Enable cloud sync'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy || !configured || !chama.cloudShareCode}
          onClick={pull}
        >
          <Download size={14} /> Pull latest
        </button>
        {chama.cloudShareCode ? (
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={copyCode}>
              {copied ? <Check size={14} /> : <Copy size={14} />} Code
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={copyLive}>
              <Cloud size={14} /> Live board link
            </button>
          </>
        ) : null}
      </div>

      {chama.cloudSyncedAt ? (
        <p className="muted" style={{ fontSize: '0.8rem', margin: '0.5rem 0 0' }}>
          Last sync {new Date(chama.cloudSyncedAt).toLocaleString('en-KE')} · rev {chama.cloudRev || 0}
        </p>
      ) : null}

      <div className="join-row">
        <div className="field" style={{ marginBottom: 0, flex: 1 }}>
          <label>Join group on this device (secretary)</label>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Share code e.g. AB3K7M2P"
            maxLength={12}
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || !configured || !joinCode.trim()}
          onClick={joinAsDevice}
          style={{ alignSelf: 'flex-end' }}
        >
          <RefreshCw size={14} /> Join
        </button>
      </div>
    </div>
  );
}

/* ─── Table banking loans ─── */

export function LoansView({
  chama,
  onUpdate,
  setFlash,
}: {
  chama: Chama;
  onUpdate: Updater;
  setFlash: (s: string) => void;
}) {
  const summary = loanSummary(chama);
  const pot = potTotal(chama);
  const [memberId, setMemberId] = useState(chama.members[0]?.id || '');
  const [principal, setPrincipal] = useState(1000);
  const [rate, setRate] = useState(10);
  const [dueDate, setDueDate] = useState(today());
  const [guarantorId, setGuarantorId] = useState('');
  const [note, setNote] = useState('');
  const [repayLoanId, setRepayLoanId] = useState(activeLoans(chama)[0]?.id || '');
  const [repayAmount, setRepayAmount] = useState(500);
  const [repayCode, setRepayCode] = useState('');

  const issue = () => {
    const res = issueLoan(chama, {
      memberId,
      principal,
      interestRate: rate,
      dueDate,
      guarantorIds: guarantorId ? [guarantorId] : [],
      note,
    });
    if (res.error) return alert(res.error);
    onUpdate(chama.id, () => res.chama);
    setFlash(`Loan issued to ${memberName(chama, memberId)}. Pot updated.`);
  };

  const repay = () => {
    const res = repayLoan(chama, {
      loanId: repayLoanId,
      amount: repayAmount,
      mpesaCode: repayCode,
    });
    if (res.error) return alert(res.error);
    onUpdate(chama.id, () => res.chama);
    setFlash('Repayment recorded — pot increased.');
    setRepayCode('');
  };

  return (
    <div>
      <div className="card">
        <h2>
          <HandCoins size={20} style={{ verticalAlign: 'middle' }} /> Table banking loans
        </h2>
        <p className="muted">
          Soft-ledger ASCA loans from the pot. Interest stays in the group. No bank underwriting.
        </p>
        <div className="grid-3">
          <div className="stat">
            <div className="stat-label">Pot available</div>
            <div className="stat-value">{money(pot, chama.currency)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Loans out</div>
            <div className="stat-value">{money(summary.outstanding, chama.currency)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Active / overdue</div>
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>
              {summary.activeCount}
              {summary.overdueCount > 0 ? (
                <span className="badge badge-warn" style={{ marginLeft: 6 }}>
                  {summary.overdueCount} overdue
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Issue loan</h3>
        <div className="grid-2">
          <div className="field">
            <label>Borrower</label>
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              {chama.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Principal (KES)</label>
            <input type="number" value={principal} onChange={(e) => setPrincipal(Number(e.target.value) || 0)} />
          </div>
          <div className="field">
            <label>Interest %</label>
            <input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} />
          </div>
          <div className="field">
            <label>Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Guarantor (optional)</label>
            <select value={guarantorId} onChange={(e) => setGuarantorId(e.target.value)}>
              <option value="">— None —</option>
              {otherMembers(chama, memberId).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Working capital…" />
          </div>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem' }}>
          Total due ≈ {money(principal + (principal * rate) / 100, chama.currency)} (principal + interest)
        </p>
        <button type="button" className="btn btn-primary" onClick={issue} disabled={!chama.members.length}>
          Disburse from pot
        </button>
      </div>

      <div className="card">
        <h3>Record repayment</h3>
        {activeLoans(chama).length === 0 ? (
          <p className="muted">No active loans.</p>
        ) : (
          <>
            <div className="grid-2">
              <div className="field">
                <label>Loan</label>
                <select value={repayLoanId} onChange={(e) => setRepayLoanId(e.target.value)}>
                  {activeLoans(chama).map((l) => (
                    <option key={l.id} value={l.id}>
                      {memberName(chama, l.memberId)} — bal {money(loanBalance(l), chama.currency)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Amount</label>
                <input
                  type="number"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(Number(e.target.value) || 0)}
                />
              </div>
              <div className="field">
                <label>M-Pesa code</label>
                <input
                  value={repayCode}
                  onChange={(e) => setRepayCode(e.target.value.toUpperCase())}
                  placeholder="Optional"
                />
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={repay}>
              Save repayment
            </button>
          </>
        )}
      </div>

      <div className="card">
        <h3>Loan book</h3>
        {(chama.loans || []).length === 0 ? (
          <p className="muted">No loans yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Principal</th>
                  <th>Due</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(chama.loans || []).map((l) => (
                  <tr key={l.id}>
                    <td>
                      {memberName(chama, l.memberId)}
                      <div className="muted" style={{ fontSize: '0.78rem' }}>
                        G: {guarantorNames(chama, l)}
                      </div>
                    </td>
                    <td>{money(l.principal, chama.currency)}</td>
                    <td>
                      {money(l.totalDue, chama.currency)}
                      <div className="muted" style={{ fontSize: '0.78rem' }}>
                        by {l.dueDate}
                      </div>
                    </td>
                    <td>{money(loanBalance(l), chama.currency)}</td>
                    <td>
                      <span
                        className={`badge ${
                          l.status === 'repaid'
                            ? 'badge-ok'
                            : l.status === 'defaulted'
                              ? 'badge-warn'
                              : l.dueDate < today()
                                ? 'badge-warn'
                                : 'badge-claim'
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td>
                      {l.status === 'active' ? (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            if (!confirm('Mark defaulted?')) return;
                            onUpdate(chama.id, (c) => markLoanDefaulted(c, l.id));
                          }}
                        >
                          Default
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Payment partners / M-Pesa STK ─── */

export function PartnersView({
  chama,
  onUpdate,
  setFlash,
}: {
  chama: Chama;
  onUpdate: Updater;
  setFlash: (s: string) => void;
}) {
  const [phone, setPhone] = useState(chama.members[0]?.phone || '');
  const [amount, setAmount] = useState(chama.contributionAmount);
  const [memberId, setMemberId] = useState(chama.members[0]?.id || '');
  const [stkMsg, setStkMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const setPartner = (p: PaymentPartner) => {
    onUpdate(chama.id, (c) => ({ ...c, paymentPartner: p }));
  };

  const sendStk = async () => {
    setBusy(true);
    setStkMsg('');
    const res = await requestStkPush({
      phone,
      amount,
      accountRef: chama.mpesaAccountRef || chama.name.slice(0, 12),
      description: 'Chama contribution',
      tillOrShortcode: chama.mpesaPaybill || chama.mpesaTill,
    });
    setBusy(false);
    if (!res.ok) {
      setStkMsg(res.error || 'STK failed');
      return;
    }
    setStkMsg(res.customerMessage || 'STK sent');
    setFlash(
      res.demo
        ? 'Demo STK simulated — confirm payment manually when member pays.'
        : 'STK prompt sent — confirm contribution when M-Pesa succeeds.',
    );
  };

  const member = chama.members.find((m) => m.id === memberId);

  return (
    <div>
      <div className="card">
        <h2>
          <Landmark size={20} style={{ verticalAlign: 'middle' }} /> Payment partners
        </h2>
        <p className="muted">
          Bank-agnostic rails. Start with Till/Paybill labels; add STK when Daraja credentials are on Vercel.
          Money custody stays optional.
        </p>

        <div className="partner-pills" role="group" aria-label="Payment partner">
          {(
            [
              ['manual', 'Manual / cash'],
              ['mpesa_stk', 'M-Pesa STK'],
              ['bank_label', 'Bank labels only'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`mode-btn ${chama.paymentPartner === id ? 'is-active' : ''}`}
              onClick={() => setPartner(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: '0.88rem' }}>
          Active: <strong>{partnerLabel(chama.paymentPartner)}</strong>
        </p>
      </div>

      <div className="card">
        <h3>Till / Paybill labels</h3>
        <div className="grid-2">
          <div className="field">
            <label>M-Pesa Till (Buy Goods)</label>
            <input
              value={chama.mpesaTill}
              onChange={(e) => onUpdate(chama.id, (c) => ({ ...c, mpesaTill: e.target.value }))}
              placeholder="123456"
            />
          </div>
          <div className="field">
            <label>Paybill</label>
            <input
              value={chama.mpesaPaybill}
              onChange={(e) => onUpdate(chama.id, (c) => ({ ...c, mpesaPaybill: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div className="field">
            <label>Account / chama ref</label>
            <input
              value={chama.mpesaAccountRef}
              onChange={(e) => onUpdate(chama.id, (c) => ({ ...c, mpesaAccountRef: e.target.value }))}
              placeholder="e.g. UMOJA"
            />
          </div>
        </div>
        <pre className="pay-instructions">{paymentInstruction(chama)}</pre>
      </div>

      <div className="card">
        <h3>
          <Smartphone size={18} style={{ verticalAlign: 'middle' }} /> STK Push (Lipa na M-Pesa)
        </h3>
        <p className="muted">
          Live STK needs <code>MPESA_*</code> secrets on Vercel. Without them, demo mode runs (no real charge).
        </p>
        <div className="grid-2">
          <div className="field">
            <label>Member (fills phone)</label>
            <select
              value={memberId}
              onChange={(e) => {
                setMemberId(e.target.value);
                const m = chama.members.find((x) => x.id === e.target.value);
                if (m?.phone) setPhone(m.phone);
              }}
            >
              {chama.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" />
          </div>
          <div className="field">
            <label>Amount</label>
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
          </div>
        </div>
        <div className="toolbar">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={sendStk}>
            {busy ? 'Sending…' : 'Send STK prompt'}
          </button>
          {member?.phone && toMsisdn(member.phone) ? (
            <a
              className="btn btn-secondary"
              href={whatsappUrl(
                member.phone,
                `Habari ${member.name}, please complete the M-Pesa prompt for ${money(amount, chama.currency)} (${chama.name}).`,
              )}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={14} /> WA follow-up
            </a>
          ) : null}
        </div>
        {stkMsg ? <p className="confirm-hint" style={{ marginTop: '0.75rem' }}>{stkMsg}</p> : null}
      </div>

      <div className="card">
        <h3>Bank partners (later)</h3>
        <p className="muted" style={{ marginBottom: 0 }}>
          ChamaFlow stays bank-optional. When groups are ready: export statements, optional custody partners,
          and white-label Till labels — without forcing KYC on day one.
        </p>
      </div>
    </div>
  );
}
