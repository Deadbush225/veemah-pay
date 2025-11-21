"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from '@/components/nav/Header';
import { Breadcrumbs } from '@/components/nav/Breadcrumbs';

type Account = { account_number: string; name: string; balance: number; status: "Active" | "Locked" | "Archived" };
type Transaction = { id: number; type: string; status: string; amount: number; target_account?: string | null; note?: string | null };

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Account | null>(null);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<Account["status"]>("Active");
  const [depAmount, setDepAmount] = useState("");
  const [wdAmount, setWdAmount] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const fetchMe = async () => {
    const res = await fetch("/api/me");
    const data = await res.json();
    if (!data.authenticated) { router.replace("/login"); return; }
    setMe(data.account);
    if (data.account.account_number !== "0000") { router.replace("/login"); return; }
  };

  const fetchAccounts = async () => {
    const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
    const res = await fetch(`/api/accounts${qs}`);
    const data = await res.json();
    setAccounts(data.accounts || []);
  };

  const fetchTransactions = async (acc: string) => {
    const res = await fetch(`/api/transactions?account=${encodeURIComponent(acc)}&limit=50`);
    const data = await res.json();
    setTransactions(data.transactions || []);
  };

  useEffect(() => { fetchMe(); }, []);
  useEffect(() => { if (me && me.account_number === "0000") fetchAccounts(); }, [me]);
  useEffect(() => { if (selected) { setEditName(selected.name); setEditStatus(selected.status); fetchTransactions(selected.account_number); } }, [selected]);

  const updateInfo = async () => {
    if (!selected) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${selected.account_number}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, status: editStatus })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Update failed"); }
      await fetchAccounts();
      setSelected(data.account);
    } finally { setPending(false); }
  };

  const doOp = async (type: "deposit" | "withdraw") => {
    if (!selected) return;
    const amt = Number(type === "deposit" ? depAmount : wdAmount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, source_account: selected.account_number, amount: amt })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Operation failed"); }
      await fetchAccounts();
      await fetchTransactions(selected.account_number);
      setDepAmount("");
      setWdAmount("");
    } finally { setPending(false); }
  };

  const completeTx = async (id: number) => {
    const res = await fetch(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete" }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to complete"); return; }
    if (selected) fetchTransactions(selected.account_number);
  };

  const voidTx = async (id: number) => {
    const res = await fetch(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "void", reason: "" }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to void"); return; }
    if (selected) fetchTransactions(selected.account_number);
  };

  const rollbackTx = async (id: number) => {
    const res = await fetch(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rollback", reason: "" }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to rollback"); return; }
    if (selected) fetchTransactions(selected.account_number);
  };

  return (
    <main>
      <Header />
      <div className="inner container" style={{ paddingTop: 8 }}>
        <Breadcrumbs />
      </div>
      <section className="quick-actions">
        <div className="inner container" style={{ display: "grid", gap: 16 }}>
          {error && <div style={{ color: "#b00020" }}>{error}</div>}
          <div className="toolbar">
            <input placeholder="Search accounts" value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn" onClick={fetchAccounts}>Search</button>
            <button className="btn" onClick={fetchAccounts}>Refresh</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table zebra">
              <thead>
                <tr>
                  <th>Account #</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.account_number} className={selected?.account_number === a.account_number ? "selected" : ""} onClick={() => setSelected(a)}>
                    <td>{a.account_number}</td>
                    <td>{a.name}</td>
                    <td>{a.status}</td>
                    <td className="num">₱{Number(a.balance).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <div className="actions-grid">
              <div className="card">
                <h3>Edit Info</h3>
                <input placeholder="Name" value={editName} onChange={e => setEditName(e.target.value)} />
                <select value={editStatus} onChange={e => setEditStatus(e.target.value as Account["status"]) }>
                  <option>Active</option>
                  <option>Locked</option>
                  <option>Archived</option>
                </select>
                <button className="btn primary" onClick={updateInfo} disabled={pending}>Save</button>
              </div>
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
            </div>
          )}
          {selected && (
            <div className="card">
              <h3>Transactions</h3>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Target</th>
                      <th>Actions</th>
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
                        <td>
                          {t.status === "Pending" && (
                            <>
                              <button className="btn" onClick={() => completeTx(t.id)}>Complete</button>
                              <button className="btn" onClick={() => voidTx(t.id)}>Void</button>
                              <button className="btn" onClick={() => rollbackTx(t.id)}>Rollback</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}