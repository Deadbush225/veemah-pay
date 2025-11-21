"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from '@/components/nav/Header';

type Account = { account_number: string; name: string; balance: number; status: string };
type Transaction = { id: number; type: string; status: string; amount: number; target_account?: string | null; note?: string | null; created_at?: string };

export default function UserPage() {
  const router = useRouter();
  const [me, setMe] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [depAmount, setDepAmount] = useState("");
  const [wdAmount, setWdAmount] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txTarget, setTxTarget] = useState("");
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
      if (me) fetchTransactions(me.account_number);
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
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, source_account: me.account_number, amount: amt })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Operation failed"); }
      await fetchMe();
      await fetchTransactions(me.account_number);
      setDepAmount("");
      setWdAmount("");
    } finally { setPending(false); }
  };

  const doTransfer = async () => {
    if (!me) return;
    if (pending) return;
    const amt = Number(txAmount);
    if (!amt || amt <= 0 || !txTarget) { setError("Enter target and amount"); return; }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "transfer", source_account: me.account_number, target_account: txTarget, amount: amt })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Transfer failed"); }
      await fetchMe();
      await fetchTransactions(me.account_number);
      setTxAmount("");
      setTxTarget("");
    } finally { setPending(false); }
  };

  return (
    <main>
      <Header />
      <section className="quick-actions">
        <div className="inner container" style={{ display: "grid", gap: 16 }}>
          {me && (
            <div className="card">
              <h3>Account Overview</h3>
              <div>Account: {me.account_number}</div>
              <div>Name: {me.name}</div>
              <div>Status: {me.status}</div>
              <div>Balance: ₱{Number(me.balance).toFixed(2)}</div>
            </div>
          )}
          {error && <div style={{ color: "#b00020" }}>{error}</div>}
          <div className="actions-grid">
            <div className="card">
              <h3>Deposit</h3>
              <input placeholder="Amount" value={depAmount} onChange={e => setDepAmount(e.target.value)} />
              <button className="btn primary" onClick={() => doOp("deposit")} disabled={pending}>Deposit</button>
            </div>
            <div className="card">
              <h3>Withdraw</h3>
              <input placeholder="Amount" value={wdAmount} onChange={e => setWdAmount(e.target.value)} />
              <button className="btn" onClick={() => doOp("withdraw")} disabled={pending}>Withdraw</button>
            </div>
            <div className="card">
              <h3>Transfer</h3>
              <input placeholder="Target Account" value={txTarget} onChange={e => setTxTarget(e.target.value)} />
              <input placeholder="Amount" value={txAmount} onChange={e => setTxAmount(e.target.value)} />
              <button className="btn" onClick={doTransfer} disabled={pending}>Transfer</button>
            </div>
          </div>
          <div className="card">
            <h3>Recent Transactions</h3>
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