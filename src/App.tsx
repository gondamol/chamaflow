import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Home,
  FileText,
} from 'lucide-react';
import type { Chama, Contribution, Fine, Member, Payout } from './types';
import {
  load,
  save,
  uid,
  today,
  money,
  memberPaidInCycle,
  potTotal,
  nextPayoutMember,
} from './lib';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type View = 'home' | 'chama' | 'members' | 'contribute' | 'payout' | 'statement';

export default function App() {
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
        <div className="card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
          {flash}
          <button type="button" className="btn btn-sm btn-secondary" style={{ marginLeft: 8 }} onClick={() => setFlash('')}>
            OK
          </button>
        </div>
      )}

      {view === 'home' && (
        <HomeView chamas={state.chamas} onOpen={openChama} onCreate={createChama} />
      )}
      {view !== 'home' && chama && (
        <>
          {view === 'chama' && <ChamaDash chama={chama} onUpdate={updateChama} setFlash={setFlash} />}
          {view === 'members' && <MembersView chama={chama} onUpdate={updateChama} />}
          {view === 'contribute' && (
            <ContributeView
              chama={chama}
              onUpdate={updateChama}
              onDone={() => {
                setFlash('Contribution recorded.');
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
        <h1>Digital records for Kenyan chamas</h1>
        <p className="hero-lead">
          Track members, contributions, merry-go-round payouts, and fines — no more notebook fights.
          Export a PDF statement for your next meeting.
        </p>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <button type="button" className="btn btn-primary" onClick={onCreate}>
            <Plus size={16} /> Create chama
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

  const nextCycle = () => {
    if (!confirm(`Start cycle ${chama.currentCycle + 1}?`)) return;
    onUpdate(chama.id, (c) => ({ ...c, currentCycle: c.currentCycle + 1 }));
    setFlash(`Cycle ${chama.currentCycle + 1} started.`);
  };

  return (
    <div>
      <div className="card">
        <h1 style={{ fontSize: '1.5rem' }}>{chama.name}</h1>
        <p className="muted">
          Target contribution: <strong>{money(chama.contributionAmount, chama.currency)}</strong> ·
          Cycle <strong>{chama.currentCycle}</strong>
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
          <div className="stat">
            <div className="stat-label">Next payout</div>
            <div className="stat-value" style={{ fontSize: '1.05rem' }}>
              {next?.name || '—'}
            </div>
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
            placeholder="M-Pesa Till"
            value={chama.mpesaTill}
            onChange={(e) => onUpdate(chama.id, (c) => ({ ...c, mpesaTill: e.target.value }))}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '0.4rem 0.6rem' }}
          />
        </div>
      </div>

      <div className="card">
        <h3>This cycle contributions</h3>
        <div className="table-wrap" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {chama.members.map((m) => {
                const paid = memberPaidInCycle(chama, m.id, chama.currentCycle);
                const ok = paid >= chama.contributionAmount;
                return (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{money(paid, chama.currency)}</td>
                    <td>
                      <span className={`badge ${ok ? 'badge-ok' : 'badge-warn'}`}>
                        {ok ? 'Complete' : 'Pending'}
                      </span>
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

function MembersView({
  chama,
  onUpdate,
}: {
  chama: Chama;
  onUpdate: (id: string, fn: (c: Chama) => Chama) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

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
      payoutOrder: [...c.payoutOrder, m.id],
    }));
    setName('');
    setPhone('');
  };

  return (
    <div className="card">
      <h2>Members</h2>
      <div className="grid-2">
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
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
            {chama.members.map((m, i) => (
              <tr key={m.id}>
                <td>{i + 1}</td>
                <td>{m.name}</td>
                <td>{m.phone || '—'}</td>
                <td>{chama.payoutOrder.indexOf(m.id) + 1 || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  onDone: () => void;
}) {
  const [memberId, setMemberId] = useState(chama.members[0]?.id || '');
  const [amount, setAmount] = useState(chama.contributionAmount);
  const [note, setNote] = useState('');

  const save = () => {
    if (!memberId) return alert('Add members first');
    const c: Contribution = {
      id: uid('c'),
      memberId,
      amount,
      date: today(),
      note,
      cycle: chama.currentCycle,
    };
    onUpdate(chama.id, (ch) => ({ ...ch, contributions: [c, ...ch.contributions] }));
    onDone();
  };

  return (
    <div className="card">
      <h2>
        <Wallet size={20} style={{ verticalAlign: 'middle' }} /> Record contribution
      </h2>
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
      <div className="field">
        <label>Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="M-Pesa code…" />
      </div>
      <button type="button" className="btn btn-primary" onClick={save}>
        Save contribution
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

  const save = () => {
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
      <p className="muted">
        Suggested next (order): <strong>{suggested?.name || '—'}</strong> · Pot{' '}
        {money(potTotal(chama), chama.currency)}
      </p>
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
      <div className="field">
        <label>Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button type="button" className="btn btn-primary" onClick={save}>
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

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h2>Group statement</h2>
          <p className="muted">Share at the next meeting. PDF download ready.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={downloadPdf}>
          Download PDF
        </button>
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
