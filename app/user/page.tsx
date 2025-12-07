"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from '@/components/nav/Header';
import { SpendingGraph } from '@/components/dashboard/SpendingGraph';
import { useLanguage } from '@/components/ui/LanguageProvider';

type Account = { account_number: string; name: string; balance: number; status: string };
type Transaction = { id: number; type: string; status: string; amount: number; target_account?: string | null; note?: string | null; created_at?: string };

export default function UserPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [me, setMe] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [depAmount, setDepAmount] = useState("");
  const [wdAmount, setWdAmount] = useState("");
  const [wdPin, setWdPin] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txTarget, setTxTarget] = useState("");
  const [txPin, setTxPin] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const fetchMe = async () => {
    const res = await fetch("/api/me");
    if (res.status === 200) {
      const data = await res.json();
      if (data.authenticated) {
        if (data.account?.account_number === "0000") { router.replace("/admin"); return; }
        setMe(data.account);
      } else {
        router.replace("/login");
      }
    } else {
      router.replace("/login");
    }
  };

  const fetchTransactions = async (acc: string) => {
    const res = await fetch(`/api/transactions?account=${encodeURIComponent(acc)}&limit=50`);
    const data = await res.json();
    setTransactions(data.transactions || []);
  };

  useEffect(() => {
    fetchMe().then(() => {
      // Need to re-fetch me to get the account number if it wasn't set yet, 
      // but simpler is to let the second useEffect handle it.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (me) fetchTransactions(me.account_number);
  }, [me]);

  const doOp = async (type: "deposit" | "withdraw") => {
    if (!me) return;
    if (pending) return;
    const amt = Number(type === "deposit" ? depAmount : wdAmount);
    if (!amt || amt <= 0) { setError(t('user.enter_valid_amount')); return; }
    
    // Require PIN for withdraw
    if (type === "withdraw" && !wdPin) { setError(t('user.enter_pin')); return; }

    setPending(true);
    setError(null);
    try {
      const body: any = { type, source_account: me.account_number, amount: amt };
      if (type === "withdraw") body.pin = wdPin;

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('user.operation_failed')); }
      await fetchMe();
      await fetchTransactions(me.account_number);
      setDepAmount("");
      setWdAmount("");
      setWdPin("");
    } finally { setPending(false); }
  };

  const doTransfer = async () => {
    if (!me) return;
    if (pending) return;
    const amt = Number(txAmount);
    if (!amt || amt <= 0 || !txTarget) { setError(t('user.enter_target_amount')); return; }
    if (!txPin) { setError(t('user.enter_pin')); return; }

    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "transfer", source_account: me.account_number, target_account: txTarget, amount: amt, pin: txPin })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('user.transfer_failed')); }
      await fetchMe();
      await fetchTransactions(me.account_number);
      setTxAmount("");
      setTxTarget("");
      setTxPin("");
    } finally { setPending(false); }
  };

  return (
    <main>
      <Header />
      <section className="quick-actions">
        <div className="inner container" style={{ display: "grid", gap: 16 }}>
          {me && (
            <div className="card">
              <h3>{t('dash.overview')}</h3>
              <div>{t('dash.account')}: {me.account_number}</div>
              <div>{t('dash.name')}: {me.name}</div>
              <div>{t('dash.status')}: {me.status}</div>
              <div>{t('dash.balance')}: ₱{Number(me.balance).toFixed(2)}</div>
            </div>
          )}
          {error && <div style={{ color: "#b00020" }}>{error}</div>}
          
          <div className="actions-grid">
            <div className="card">
              <h3>{t('dash.deposit')}</h3>
              <input placeholder={t('dash.amount')} value={depAmount} onChange={e => setDepAmount(e.target.value)} />
              <button className="btn primary" onClick={() => doOp("deposit")} disabled={pending}>{t('dash.deposit')}</button>
            </div>
            <div className="card">
              <h3>{t('dash.withdraw')}</h3>
              <input placeholder={t('dash.amount')} value={wdAmount} onChange={e => setWdAmount(e.target.value)} />
              <input type="password" placeholder={t('user.pin_placeholder')} value={wdPin} onChange={e => setWdPin(e.target.value)} maxLength={4} style={{ marginTop: 8 }} />
              <button className="btn" onClick={() => doOp("withdraw")} disabled={pending}>{t('dash.withdraw')}</button>
            </div>
            <div className="card">
              <h3>{t('dash.transfer')}</h3>
              <input placeholder={t('dash.target')} value={txTarget} onChange={e => setTxTarget(e.target.value)} />
              <input placeholder={t('dash.amount')} value={txAmount} onChange={e => setTxAmount(e.target.value)} />
              <input type="password" placeholder={t('user.pin_placeholder')} value={txPin} onChange={e => setTxPin(e.target.value)} maxLength={4} style={{ marginTop: 8 }} />
              <button className="btn" onClick={doTransfer} disabled={pending}>{t('dash.transfer')}</button>
            </div>
          </div>

          <div className="card">
            <h3>{t('dash.spending')}</h3>
            <SpendingGraph transactions={transactions} />
          </div>

          <div className="card">
            <h3>{t('dash.recent_tx')}</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="table zebra">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id}>
                      <td>{t.id}</td>
                      <td>{t.type}</td>
                      <td>{t.status}</td>
                      <td className="num">₱{Number(t.amount).toFixed(2)}</td>
                      <td>{t.target_account || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
