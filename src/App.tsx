import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Home,
  FileText,
  Share2,
  MessageCircle,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  SkipForward,
  Link2,
  AlertCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { Chama, Fine, Member, Payout, PublicBoardSnapshot } from './types';
import {
  load,
  save,
  uid,
  today,
  money,
  memberPaidInCycle,
  memberClaimedInCycle,
  memberCycleStatus,
  potTotal,
  nextPayoutMember,
  unpaidMembers,
  pendingClaims,
  paymentReminderMessage,
  groupReminderMessage,
  claimFollowUpMessage,
  whatsappUrl,
  buildPublicBoard,
  publicBoardUrl,
  parseHashRoute,
  decodeBoard,
  membersInPayoutOrder,
  hasReceivedThisRound,
  movePayoutOrder,
  skipNextPayout,
  makeContribution,
  confirmContribution,
  rejectClaim,
} from './lib';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type View = 'home' | 'chama' | 'members' | 'contribute' | 'payout' | 'statement';

export default function App() {
  const [route, setRoute] = useState(parseHashRoute);

  useEffect(() => {
    const onHash = () => setRoute(parseHashRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (route.type === 'board') {
    return <PublicBoardPage token={route.token} />;
  }
  return <TreasurerApp />;
}

/* ═══════════════════════════════════════════════════════════
   Public cycle board — read-only share link for members
   ═══════════════════════════════════════════════════════════ */

function PublicBoardPage({ token }: { token: string }) {
  const board = useMemo(() => decodeBoard(token), [token]);

  if (!board) {
    return (
      <div className="shell board-shell">
        <header className="topbar">
          <div className="brand">
            <span className="mark">C</span>
            ChamaFlow
          </div>
        </header>
        <div className="card empty">
          <h2>Link invalid or expired</h2>
          <p className="muted">Ask your treasurer to share a fresh cycle board link.</p>
          <a className="btn btn-primary" href="#/">
            Open ChamaFlow
          </a>
        </div>
      </div>
    );
  }

  return <PublicBoardView board={board} />;
}

function statusBadgeClass(status: string) {
  if (status === 'paid') return 'badge-ok';
  if (status === 'claimed') return 'badge-claim';
  return 'badge-warn';
}

function statusLabel(status: string) {
  if (status === 'paid') return 'Paid ✓';
  if (status === 'claimed') return 'Claims paid';
  return 'Pending';
}

function PublicBoardView({ board }: { board: PublicBoardSnapshot }) {
  const paidCount = board.members.filter((m) => m.status === 'paid').length;
  const claimedCount = board.members.filter((m) => m.status === 'claimed').length;
  const pending = board.members.filter((m) => m.status === 'pending');
  const updated = new Date(board.updatedAt);
  const updatedLabel = Number.isNaN(updated.getTime())
    ? board.updatedAt
    : updated.toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });

  const statusRank = (s: string) => (s === 'pending' ? 0 : s === 'claimed' ? 1 : 2);

  return (
    <div className="shell board-shell">
      <header className="topbar">
        <div className="brand">
          <span className="mark">C</span>
          ChamaFlow
        </div>
        <span className="badge">Public board · read only</span>
      </header>

      <section className="card board-hero">
        <p className="board-kicker">Cycle trust board</p>
        <h1 style={{ fontSize: '1.55rem' }}>{board.name}</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          Cycle <strong>{board.cycle}</strong> · Contribution{' '}
          <strong>{money(board.amount, board.currency)}</strong>
          {board.till ? (
            <>
              {' '}
              · Till <strong className="till-pill">{board.till}</strong>
            </>
          ) : null}
        </p>
        <div className="grid-3" style={{ marginTop: '0.9rem' }}>
          <div className="stat">
            <div className="stat-label">Paid (confirmed)</div>
            <div className="stat-value">
              {paidCount}/{board.members.length}
            </div>
          </div>
          <div className="stat stat-next">
            <div className="stat-label">Next payout</div>
            <div className="stat-value" style={{ fontSize: '1.05rem' }}>
              {board.nextName || '—'}
              {board.nextOrder ? (
                <span className="muted" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  {' '}
                  (#{board.nextOrder})
                </span>
              ) : null}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Pending / claims</div>
            <div className="stat-value" style={{ fontSize: '1.05rem' }}>
              {pending.length}
              {claimedCount > 0 ? (
                <span className="muted" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  {' '}
                  · {claimedCount} claim{claimedCount === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {board.till ? (
          <p className="pay-hint">
            Lipa na M-Pesa → Buy Goods / Paybill as agreed → Till <strong>{board.till}</strong> ·{' '}
            {money(board.amount, board.currency)}. Send your M-Pesa code to the treasurer.
          </p>
        ) : (
          <p className="pay-hint">Pay cash or M-Pesa as agreed. Treasurer confirms with M-Pesa code.</p>
        )}
        <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
          Updated {updatedLabel} · Soft ledger (no bank wallet required)
        </p>
      </section>

      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Who has paid?</h2>
        <p className="muted">
          Paid = treasurer confirmed. Claims paid = member says they paid, awaiting check. No notebook fights.
        </p>
        <ul className="board-list">
          {[...board.members]
            .sort((a, b) => {
              if (a.isNext !== b.isNext) return a.isNext ? -1 : 1;
              if (a.status !== b.status) return statusRank(a.status) - statusRank(b.status);
              return (a.order || 99) - (b.order || 99);
            })
            .map((m) => (
              <li
                key={`${m.name}-${m.order}`}
                className={`board-row is-${m.status} ${m.isNext ? 'is-next' : ''}`}
              >
                <div className="board-row-main">
                  <span className="board-order">{m.order || '—'}</span>
                  <div>
                    <div className="board-name">
                      {m.name}
                      {m.isNext ? <span className="badge badge-next">Next payout</span> : null}
                    </div>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      {money(m.paid, board.currency)} of {money(board.amount, board.currency)}
                      {m.status === 'claimed' ? ' · awaiting confirm' : ''}
                    </div>
                  </div>
                </div>
                <span className={`badge ${statusBadgeClass(m.status)}`}>{statusLabel(m.status)}</span>
              </li>
            ))}
        </ul>
      </section>

      <p className="board-footer muted">
        Powered by ChamaFlow — WhatsApp-native group trust. Not a bank.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Treasurer app (local soft ledger)
   ═══════════════════════════════════════════════════════════ */

function TreasurerApp() {
  const [state, setState] = useState(() => load());
  const [view, setView] = useState<View>('home');
  const [flash, setFlash] = useState('');

  useEffect(() => {
    save(state);
  }, [state]);

  const chama = state.chamas.find((c) => c.id === state.activeChamaId) || state.chamas[0];

  const openChama = (id: string) => {
    setState((s) => ({ ...s, activeChamaId: id }));
    setView('chama');
  };

  const updateChama = (id: string, fn: (c: Chama) => Chama) => {
    setState((s) => ({
      ...s,
      chamas: s.chamas.map((c) => (c.id === id ? fn(c) : c)),
    }));
  };

  const createChama = () => {
    const name = prompt('Chama name', 'New Chama');
    if (!name?.trim()) return;
    const c: Chama = {
      id: uid('ch'),
      name: name.trim(),
      description: '',
      contributionAmount: 1000,
      currency: 'KES',
      cycleDay: 1,
      currentCycle: 1,
      mpesaTill: '',
      adminName: '',
      adminPhone: '',
      members: [],
      contributions: [],
      payouts: [],
      fines: [],
      payoutOrder: [],
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({ chamas: [c, ...s.chamas], activeChamaId: c.id }));
    setView('chama');
  };

  return (
    <div className="shell">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => setView('home')}>
          <span className="mark">C</span>
          ChamaFlow
        </button>
        <nav className="nav">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView('home')}>
            <Home size={14} /> Groups
          </button>
          {chama && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView('chama')}>
                Dashboard
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView('members')}>
                <Users size={14} /> Members
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView('contribute')}>
                <ArrowDownCircle size={14} /> Contribute
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView('payout')}>
                <ArrowUpCircle size={14} /> Payout
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView('statement')}>
                <FileText size={14} /> Statement
              </button>
            </>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={createChama}>
            <Plus size={14} /> New chama
          </button>
        </nav>
      </header>

      {flash && (
        <div className="card flash-ok">
          {flash}
          <button type="button" className="btn btn-sm btn-secondary" style={{ marginLeft: 8 }} onClick={() => setFlash('')}>
            OK
          </button>
        </div>
      )}

      {view === 'home' && <HomeView chamas={state.chamas} onOpen={openChama} onCreate={createChama} />}
      {view !== 'home' && chama && (
        <>
          {view === 'chama' && <ChamaDash chama={chama} onUpdate={updateChama} setFlash={setFlash} />}
          {view === 'members' && <MembersView chama={chama} onUpdate={updateChama} />}
          {view === 'contribute' && (
            <ContributeView
              chama={chama}
              onUpdate={updateChama}
              onDone={(kind) => {
                setFlash(
                  kind === 'claim'
                    ? 'Claim logged — confirm when you verify the M-Pesa code.'
                    : 'Payment confirmed and added to pot.',
                );
                setView('chama');
              }}
            />
          )}
          {view === 'payout' && (
            <PayoutView
              chama={chama}
              onUpdate={updateChama}
              onDone={() => {
                setFlash('Payout recorded.');
                setView('chama');
              }}
            />
          )}
          {view === 'statement' && <StatementView chama={chama} />}
        </>
      )}
    </div>
  );
}

function HomeView({
  chamas,
  onOpen,
  onCreate,
}: {
  chamas: Chama[];
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div>
      <section className="hero card">
        <h1>Banks digitize money. We digitize the meeting.</h1>
        <p className="hero-lead">
          Soft ledger + public cycle board for informal chamas. Track who paid, who&apos;s next on the
          merry-go-round, and nudge members on WhatsApp — no KYC, no bank wallet required.
        </p>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <button type="button" className="btn btn-primary" onClick={onCreate}>
            <Plus size={16} /> Create chama (60 seconds)
          </button>
        </div>
      </section>

      <h2 style={{ margin: '1rem 0 0.6rem' }}>Your groups</h2>
      {chamas.length === 0 ? (
        <div className="empty card">No chamas yet. Create your first group.</div>
      ) : (
        chamas.map((c) => (
          <button
            key={c.id}
            type="button"
            className="card"
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => onOpen(c.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: 0 }}>{c.name}</h3>
                <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                  {c.members.length} members · Cycle {c.currentCycle} · Pot {money(potTotal(c), c.currency)}
                </p>
              </div>
              <span className="badge">Open</span>
            </div>
          </button>
        ))
      )}
    </div>
  );
}

function ChamaDash({
  chama,
  onUpdate,
  setFlash,
}: {
  chama: Chama;
  onUpdate: (id: string, fn: (c: Chama) => Chama) => void;
  setFlash: (s: string) => void;
}) {
  const pot = potTotal(chama);
  const next = nextPayoutMember(chama);
  const paidCount = chama.members.filter(
    (m) => memberPaidInCycle(chama, m.id, chama.currentCycle) >= chama.contributionAmount,
  ).length;
  const unpaid = unpaidMembers(chama);
  const [copied, setCopied] = useState(false);

  const nextCycle = () => {
    if (!confirm(`Start cycle ${chama.currentCycle + 1}?`)) return;
    onUpdate(chama.id, (c) => ({ ...c, currentCycle: c.currentCycle + 1 }));
    setFlash(`Cycle ${chama.currentCycle + 1} started. Share a fresh board link with members.`);
  };

  const shareBoard = async () => {
    const url = publicBoardUrl(buildPublicBoard(chama));
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setFlash('Cycle board link copied — paste into WhatsApp group.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt('Copy this cycle board link:', url);
    }
  };

  const openShareBoard = () => {
    const url = publicBoardUrl(buildPublicBoard(chama));
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div>
      <div className="card">
        <h1 style={{ fontSize: '1.5rem' }}>{chama.name}</h1>
        <p className="muted">
          Target contribution: <strong>{money(chama.contributionAmount, chama.currency)}</strong> · Cycle{' '}
          <strong>{chama.currentCycle}</strong>
          {chama.mpesaTill ? ` · Till ${chama.mpesaTill}` : ''}
        </p>
        <div className="grid-3" style={{ marginTop: '0.75rem' }}>
          <div className="stat">
            <div className="stat-label">Pot balance</div>
            <div className="stat-value">{money(pot, chama.currency)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Paid this cycle</div>
            <div className="stat-value">
              {paidCount}/{chama.members.length}
            </div>
          </div>
          <div className="stat stat-next">
            <div className="stat-label">Next payout</div>
            <div className="stat-value" style={{ fontSize: '1.05rem' }}>{next?.name || '—'}</div>
          </div>
        </div>

        <div className="share-strip">
          <div>
            <strong>Public cycle board</strong>
            <p className="muted" style={{ margin: '0.15rem 0 0', fontSize: '0.88rem' }}>
              Members open the link → see paid / pending / next / Till. Kills notebook fights.
            </p>
          </div>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={shareBoard}>
              {copied ? <Check size={14} /> : <Share2 size={14} />}
              {copied ? 'Copied!' : 'Copy share link'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={openShareBoard}>
              <Link2 size={14} /> Preview board
            </button>
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: '0.85rem', marginBottom: 0 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={nextCycle}>
            Advance cycle
          </button>
          <label className="btn btn-secondary btn-sm">
            Contribution amount
            <input
              type="number"
              style={{ width: 90, marginLeft: 8 }}
              value={chama.contributionAmount}
              onChange={(e) =>
                onUpdate(chama.id, (c) => ({
                  ...c,
                  contributionAmount: Number(e.target.value) || 0,
                }))
              }
            />
          </label>
          <input
            placeholder="M-Pesa Till / Paybill"
            value={chama.mpesaTill}
            onChange={(e) => onUpdate(chama.id, (c) => ({ ...c, mpesaTill: e.target.value }))}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '0.4rem 0.6rem' }}
          />
        </div>
      </div>

      <ClaimsQueueCard chama={chama} onUpdate={onUpdate} setFlash={setFlash} />

      <MerryGoRoundCard chama={chama} onUpdate={onUpdate} setFlash={setFlash} />

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0 }}>This cycle contributions</h3>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>
              {unpaid.length === 0
                ? 'Everyone confirmed — ready for payout meeting.'
                : `${unpaid.length} not yet confirmed. Nudge or log a claim.`}
            </p>
          </div>
          {unpaid.length > 0 && (
            <a
              className="btn btn-secondary btn-sm"
              href={whatsappUrl(null, groupReminderMessage(chama, unpaid))}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={14} /> Bulk remind (WA)
            </a>
          )}
        </div>
        <div className="table-wrap" style={{ border: 'none', marginTop: '0.6rem' }}>
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Confirmed</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {chama.members.map((m) => {
                const paid = memberPaidInCycle(chama, m.id, chama.currentCycle);
                const claimed = memberClaimedInCycle(chama, m.id, chama.currentCycle);
                const status = memberCycleStatus(chama, m.id);
                const isNext = next?.id === m.id;
                return (
                  <tr key={m.id} className={isNext ? 'row-next' : undefined}>
                    <td>
                      {m.name}
                      {isNext ? <span className="badge badge-next">Next</span> : null}
                    </td>
                    <td>
                      {money(paid, chama.currency)}
                      {claimed > 0 ? (
                        <div className="muted" style={{ fontSize: '0.78rem' }}>
                          +{money(claimed, chama.currency)} claimed
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(status)}`}>{statusLabel(status)}</span>
                    </td>
                    <td>
                      <div className="toolbar" style={{ marginBottom: 0, gap: 4 }}>
                        {status !== 'paid' ? (
                          <>
                            <a
                              className="btn btn-secondary btn-sm"
                              href={whatsappUrl(m.phone, paymentReminderMessage(chama, m.name))}
                              target="_blank"
                              rel="noreferrer"
                              title={m.phone ? `WhatsApp ${m.phone}` : 'Open WhatsApp'}
                            >
                              <MessageCircle size={14} /> WA
                            </a>
                            {status === 'pending' ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                title="Log Nililipa claim"
                                onClick={() => {
                                  const code = prompt(
                                    `${m.name} claims paid — paste M-Pesa code (optional)`,
                                    '',
                                  );
                                  if (code === null) return;
                                  const c = makeContribution({
                                    memberId: m.id,
                                    amount: chama.contributionAmount,
                                    cycle: chama.currentCycle,
                                    mpesaCode: code,
                                    note: 'Member claims paid (Nililipa)',
                                    status: 'claimed',
                                  });
                                  onUpdate(chama.id, (ch) => ({
                                    ...ch,
                                    contributions: [c, ...ch.contributions],
                                  }));
                                  setFlash(
                                    `Claim logged for ${m.name}. Confirm when you verify the M-Pesa code.`,
                                  );
                                }}
                              >
                                <AlertCircle size={14} /> Claims
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ClaimsQueueCard({
  chama,
  onUpdate,
  setFlash,
}: {
  chama: Chama;
  onUpdate: (id: string, fn: (c: Chama) => Chama) => void;
  setFlash: (s: string) => void;
}) {
  const claims = pendingClaims(chama);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [codeDraft, setCodeDraft] = useState('');

  if (claims.length === 0) return null;

  return (
    <div className="card claims-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={18} /> Payment claims to verify
          </h3>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            Members said &quot;Nililipa!&quot; — confirm with M-Pesa code or reject. Claims do not enter the pot until
            confirmed.
          </p>
        </div>
        <span className="badge badge-claim">{claims.length} open</span>
      </div>
      <ul className="claims-list">
        {claims.map((c) => {
          const member = chama.members.find((m) => m.id === c.memberId);
          const name = member?.name || 'Member';
          const isEditing = editingId === c.id;
          return (
            <li key={c.id} className="claim-item">
              <div className="claim-main">
                <strong>{name}</strong>
                <span className="muted">
                  {money(c.amount, chama.currency)} · {c.date}
                  {c.mpesaCode ? (
                    <>
                      {' '}
                      · Code <code className="mpesa-code">{c.mpesaCode}</code>
                    </>
                  ) : (
                    ' · no code yet'
                  )}
                </span>
                {c.note ? <div className="muted" style={{ fontSize: '0.85rem' }}>{c.note}</div> : null}
                {isEditing ? (
                  <div className="field" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                    <label>M-Pesa code</label>
                    <input
                      value={codeDraft}
                      onChange={(e) => setCodeDraft(e.target.value.toUpperCase())}
                      placeholder="e.g. QH12ABCDE3"
                      autoFocus
                    />
                  </div>
                ) : null}
              </div>
              <div className="claim-actions">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        onUpdate(chama.id, (ch) =>
                          confirmContribution(ch, c.id, { mpesaCode: codeDraft || c.mpesaCode }),
                        );
                        setEditingId(null);
                        setFlash(`${name} confirmed — pot updated.`);
                      }}
                    >
                      <ShieldCheck size={14} /> Confirm
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setEditingId(c.id);
                        setCodeDraft(c.mpesaCode || '');
                      }}
                    >
                      <ShieldCheck size={14} /> Confirm
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        const reason = prompt('Reject reason (optional)', 'Could not verify M-Pesa code');
                        if (reason === null) return;
                        onUpdate(chama.id, (ch) => rejectClaim(ch, c.id, reason || 'Rejected'));
                        setFlash(`Claim for ${name} rejected.`);
                      }}
                    >
                      <X size={14} /> Reject
                    </button>
                    {member?.phone ? (
                      <a
                        className="btn btn-secondary btn-sm"
                        href={whatsappUrl(
                          member.phone,
                          claimFollowUpMessage(chama, name, c.mpesaCode),
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle size={14} /> WA
                      </a>
                    ) : null}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MerryGoRoundCard({
  chama,
  onUpdate,
  setFlash,
}: {
  chama: Chama;
  onUpdate: (id: string, fn: (c: Chama) => Chama) => void;
  setFlash: (s: string) => void;
}) {
  const ordered = membersInPayoutOrder(chama);
  const next = nextPayoutMember(chama);

  if (chama.members.length === 0) {
    return (
      <div className="card">
        <h3>Merry-go-round order</h3>
        <p className="muted">Add members first, then set who gets the pot and when.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>Merry-go-round order</h3>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            Next in line:{' '}
            <strong className="next-name">{next?.name || '—'}</strong>
            {next ? ' · highlighted below' : ''}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!next}
          onClick={() => {
            if (!next) return;
            if (!confirm(`Skip ${next.name} this turn? They move after others still waiting.`)) return;
            onUpdate(chama.id, (c) => skipNextPayout(c));
            setFlash(`${next.name} skipped — next person updated.`);
          }}
        >
          <SkipForward size={14} /> Skip next
        </button>
      </div>

      <ol className="mgr-list">
        {ordered.map((m, i) => {
          const received = hasReceivedThisRound(chama, m.id);
          const isNext = next?.id === m.id;
          return (
            <li key={m.id} className={`mgr-item ${isNext ? 'is-next' : ''} ${received ? 'is-done' : ''}`}>
              <div className="mgr-left">
                <span className="mgr-pos">{i + 1}</span>
                <div>
                  <div className="mgr-name">
                    {m.name}
                    {isNext ? <span className="badge badge-next">NEXT</span> : null}
                    {received && !isNext ? <span className="badge badge-ok">Received</span> : null}
                    {!received && !isNext ? <span className="badge">Waiting</span> : null}
                  </div>
                  <div className="muted" style={{ fontSize: '0.82rem' }}>{m.phone || 'No phone'}</div>
                </div>
              </div>
              <div className="mgr-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm icon-btn"
                  disabled={i === 0}
                  aria-label="Move up"
                  onClick={() => onUpdate(chama.id, (c) => movePayoutOrder(c, m.id, -1))}
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm icon-btn"
                  disabled={i === ordered.length - 1}
                  aria-label="Move down"
                  onClick={() => onUpdate(chama.id, (c) => movePayoutOrder(c, m.id, 1))}
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MembersView({
  chama,
  onUpdate,
}: {
  chama: Chama;
  onUpdate: (id: string, fn: (c: Chama) => Chama) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const next = nextPayoutMember(chama);

  const add = () => {
    if (!name.trim()) return;
    const m: Member = {
      id: uid('m'),
      name: name.trim(),
      phone: phone.trim(),
      joinedAt: today(),
    };
    onUpdate(chama.id, (c) => ({
      ...c,
      members: [...c.members, m],
      payoutOrder: [...(c.payoutOrder.length ? c.payoutOrder : c.members.map((x) => x.id)), m.id],
    }));
    setName('');
    setPhone('');
  };

  return (
    <div className="card">
      <h2>Members</h2>
      <p className="muted">Phone is used for one-tap WhatsApp payment reminders.</p>
      <div className="grid-2">
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amina Wanjiku" />
        </div>
        <div className="field">
          <label>Phone (WhatsApp)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" />
        </div>
      </div>
      <button type="button" className="btn btn-primary" onClick={add}>
        <Plus size={16} /> Add member
      </button>
      <div className="table-wrap" style={{ marginTop: '1rem' }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Payout order</th>
            </tr>
          </thead>
          <tbody>
            {membersInPayoutOrder(chama).map((m, i) => (
              <tr key={m.id} className={next?.id === m.id ? 'row-next' : undefined}>
                <td>{i + 1}</td>
                <td>
                  {m.name}
                  {next?.id === m.id ? <span className="badge badge-next">Next</span> : null}
                </td>
                <td>{m.phone || '—'}</td>
                <td>{i + 1}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
        Reorder on the Dashboard merry-go-round card (↑ ↓ / Skip next).
      </p>
    </div>
  );
}

function ContributeView({
  chama,
  onUpdate,
  onDone,
}: {
  chama: Chama;
  onUpdate: (id: string, fn: (c: Chama) => Chama) => void;
  onDone: (kind: 'confirm' | 'claim') => void;
}) {
  const unpaid = unpaidMembers(chama);
  const [mode, setMode] = useState<'confirm' | 'claim'>('confirm');
  const [memberId, setMemberId] = useState(unpaid[0]?.id || chama.members[0]?.id || '');
  const [amount, setAmount] = useState(chama.contributionAmount);
  const [mpesaCode, setMpesaCode] = useState('');
  const [note, setNote] = useState('');

  const saveContrib = () => {
    if (!memberId) return alert('Add members first');
    if (amount <= 0) return alert('Enter amount');
    const code = mpesaCode.trim().toUpperCase();
    if (mode === 'confirm' && !code && !confirm('No M-Pesa code — confirm payment anyway?')) return;

    const c = makeContribution({
      memberId,
      amount,
      cycle: chama.currentCycle,
      mpesaCode: code,
      note:
        note ||
        (mode === 'claim' ? 'Member claims paid (Nililipa)' : code ? `M-Pesa ${code}` : 'Cash / confirmed'),
      status: mode === 'claim' ? 'claimed' : 'confirmed',
    });
    onUpdate(chama.id, (ch) => ({ ...ch, contributions: [c, ...ch.contributions] }));
    onDone(mode);
  };

  return (
    <div className="card">
      <h2>
        <Wallet size={20} style={{ verticalAlign: 'middle' }} /> Record contribution
      </h2>
      <p className="muted">
        Soft ledger — money stays M-Pesa/cash. Confirm when you verified; log a claim when they say
        &quot;Nililipa!&quot;
      </p>

      <div className="mode-toggle" role="tablist" aria-label="Contribution mode">
        <button
          type="button"
          role="tab"
          className={`mode-btn ${mode === 'confirm' ? 'is-active' : ''}`}
          aria-selected={mode === 'confirm'}
          onClick={() => setMode('confirm')}
        >
          <ShieldCheck size={16} /> Confirm payment
        </button>
        <button
          type="button"
          role="tab"
          className={`mode-btn ${mode === 'claim' ? 'is-active' : ''}`}
          aria-selected={mode === 'claim'}
          onClick={() => setMode('claim')}
        >
          <AlertCircle size={16} /> Member claims paid
        </button>
      </div>

      {mode === 'claim' ? (
        <p className="claim-hint">
          Does not add to the pot until you confirm. Use when someone says they paid but you have not checked
          M-Pesa yet.
        </p>
      ) : (
        <p className="confirm-hint">
          Counts in the pot immediately. Paste the M-Pesa code for the group record.
        </p>
      )}

      <div className="field">
        <label>Member</label>
        <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          {chama.members.map((m) => {
            const status = memberCycleStatus(chama, m.id);
            const paid = memberPaidInCycle(chama, m.id, chama.currentCycle);
            return (
              <option key={m.id} value={m.id}>
                {m.name} — {statusLabel(status)}
                {paid > 0 ? ` (${money(paid, chama.currency)})` : ''}
              </option>
            );
          })}
        </select>
      </div>
      <div className="field">
        <label>Amount</label>
        <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
      </div>
      <div className="field">
        <label>M-Pesa confirmation code {mode === 'confirm' ? '(recommended)' : '(if they sent one)'}</label>
        <input
          value={mpesaCode}
          onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
          placeholder="e.g. QH12ABCDE3"
          autoCapitalize="characters"
        />
      </div>
      <div className="field">
        <label>Note (optional)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={mode === 'claim' ? 'e.g. Sent screenshot on WhatsApp' : 'e.g. Cash at meeting'}
        />
      </div>
      <button type="button" className="btn btn-primary" onClick={saveContrib}>
        {mode === 'claim' ? 'Log claim' : 'Confirm & save'}
      </button>
    </div>
  );
}

function PayoutView({
  chama,
  onUpdate,
  onDone,
}: {
  chama: Chama;
  onUpdate: (id: string, fn: (c: Chama) => Chama) => void;
  onDone: () => void;
}) {
  const suggested = nextPayoutMember(chama);
  const [memberId, setMemberId] = useState(suggested?.id || chama.members[0]?.id || '');
  const [amount, setAmount] = useState(potTotal(chama));
  const [note, setNote] = useState('Merry-go-round payout');

  const savePayout = () => {
    if (!memberId) return;
    if (amount <= 0) return alert('Enter amount');
    const p: Payout = {
      id: uid('p'),
      memberId,
      amount,
      date: today(),
      cycle: chama.currentCycle,
      note,
    };
    onUpdate(chama.id, (ch) => ({ ...ch, payouts: [p, ...ch.payouts] }));
    onDone();
  };

  return (
    <div className="card">
      <h2>Record payout</h2>
      <div className="next-banner">
        <div>
          <div className="stat-label">Suggested next (merry-go-round)</div>
          <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>{suggested?.name || '—'}</div>
        </div>
        <div className="muted">
          Pot {money(potTotal(chama), chama.currency)}
        </div>
      </div>
      <div className="field">
        <label>Member</label>
        <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          {membersInPayoutOrder(chama).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {suggested?.id === m.id ? ' ← next' : ''}
              {hasReceivedThisRound(chama, m.id) ? ' (received this round)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Amount</label>
        <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
      </div>
      <div className="field">
        <label>Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button type="button" className="btn btn-primary" onClick={savePayout}>
        Save payout
      </button>

      <div style={{ marginTop: '1.25rem' }}>
        <h3>Add fine</h3>
        <FineForm chama={chama} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

function FineForm({
  chama,
  onUpdate,
}: {
  chama: Chama;
  onUpdate: (id: string, fn: (c: Chama) => Chama) => void;
}) {
  const [memberId, setMemberId] = useState(chama.members[0]?.id || '');
  const [amount, setAmount] = useState(200);
  const [reason, setReason] = useState('Late contribution');

  return (
    <div className="grid-2">
      <div className="field">
        <label>Member</label>
        <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          {chama.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Amount</label>
        <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
      </div>
      <div className="field" style={{ gridColumn: '1 / -1' }}>
        <label>Reason</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          if (!memberId) return;
          const f: Fine = {
            id: uid('f'),
            memberId,
            amount,
            date: today(),
            reason,
            paid: true,
          };
          onUpdate(chama.id, (c) => ({ ...c, fines: [f, ...c.fines] }));
          alert('Fine recorded (counted as paid into pot).');
        }}
      >
        Record fine
      </button>
    </div>
  );
}

function StatementView({ chama }: { chama: Chama }) {
  const rows = useMemo(() => {
    return chama.members.map((m) => {
      const paid = chama.contributions
        .filter((c) => c.memberId === m.id)
        .reduce((s, c) => s + c.amount, 0);
      const received = chama.payouts
        .filter((p) => p.memberId === m.id)
        .reduce((s, p) => s + p.amount, 0);
      const fines = chama.fines
        .filter((f) => f.memberId === m.id)
        .reduce((s, f) => s + f.amount, 0);
      return { m, paid, received, fines };
    });
  }, [chama]);

  const downloadPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(chama.name, 14, 18);
    doc.setFontSize(10);
    doc.text(`Statement · Cycle ${chama.currentCycle} · Pot ${money(potTotal(chama), chama.currency)}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [['Member', 'Contributed', 'Payouts', 'Fines']],
      body: rows.map((r) => [
        r.m.name,
        money(r.paid, chama.currency),
        money(r.received, chama.currency),
        money(r.fines, chama.currency),
      ]),
      headStyles: { fillColor: [180, 83, 9] },
    });
    doc.save(`${chama.name.replace(/\s+/g, '-')}-statement.pdf`);
  };

  const shareBoard = async () => {
    const url = publicBoardUrl(buildPublicBoard(chama));
    try {
      await navigator.clipboard.writeText(url);
      alert('Cycle board link copied.');
    } catch {
      prompt('Copy link:', url);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h2>Group statement</h2>
          <p className="muted">Share at the next meeting. PDF + public board link.</p>
        </div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <button type="button" className="btn btn-secondary" onClick={shareBoard}>
            <Copy size={16} /> Copy board link
          </button>
          <button type="button" className="btn btn-primary" onClick={downloadPdf}>
            Download PDF
          </button>
        </div>
      </div>
      <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Contributed</th>
              <th>Payouts received</th>
              <th>Fines</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.m.id}>
                <td>{r.m.name}</td>
                <td>{money(r.paid, chama.currency)}</td>
                <td>{money(r.received, chama.currency)}</td>
                <td>{money(r.fines, chama.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
