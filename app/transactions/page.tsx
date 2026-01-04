"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/nav/Header";
import { useLanguage } from "@/components/ui/LanguageProvider";
import { useAuth } from "@/components/ui/AuthProvider";
import { PositiveMoney } from "@/components/ui/MoneyDisplay";

type Transaction = {
  id: number;
  type: string;
  status: string;
  amount: number;
  account_number?: string;
  target_account?: string | null;
  note?: string | null;
  created_at?: string;
};

export default function TransactionsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { me, refreshMe } = useAuth();

  const accountNumber = useMemo(() => {
    if (!me?.authenticated || me?.isAdmin) return null;
    return String(me?.account?.account_number ?? "") || null;
  }, [me]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [historyTransactions, setHistoryTransactions] = useState<Transaction[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [historyQ, setHistoryQ] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyType, setHistoryType] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyDirection, setHistoryDirection] = useState("");
  const [historyMinAmount, setHistoryMinAmount] = useState("");
  const [historyMaxAmount, setHistoryMaxAmount] = useState("");
  const [statementMonth, setStatementMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const readJson = useCallback(async (res: Response) => {
    try {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    refreshMe()
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshMe]);

  useEffect(() => {
    if (loading) return;
    if (!me?.authenticated) {
      router.replace("/login");
      return;
    }
    if (me?.isAdmin) {
      router.replace("/admin");
      return;
    }
  }, [loading, me, router]);

  const buildTxUrl = useCallback((args: { format?: string; cursor?: string | null; limit?: number; autoprint?: boolean }) => {
    if (!accountNumber) return "";
    const u = new URL("/api/transactions", window.location.origin);
    u.searchParams.set("account", accountNumber);
    u.searchParams.set("limit", String(args.limit ?? 50));
    if (args.format) u.searchParams.set("format", args.format);
    if (args.cursor) u.searchParams.set("cursor", args.cursor);
    const q = historyQ.trim();
    if (q) u.searchParams.set("q", q);
    if (historyFrom) u.searchParams.set("from", `${historyFrom}T00:00:00.000Z`);
    if (historyTo) u.searchParams.set("to", `${historyTo}T23:59:59.999Z`);
    if (historyType) u.searchParams.set("type", historyType);
    if (historyStatus) u.searchParams.set("status", historyStatus);
    if (historyDirection) u.searchParams.set("direction", historyDirection);
    if (historyMinAmount.trim()) u.searchParams.set("min_amount", historyMinAmount.trim());
    if (historyMaxAmount.trim()) u.searchParams.set("max_amount", historyMaxAmount.trim());
    if (statementMonth && (args.format === "statement" || args.format === "csv")) {
      u.searchParams.set("month", statementMonth);
    }
    if (args.autoprint) u.searchParams.set("autoprint", "1");
    return u.toString();
  }, [accountNumber, historyDirection, historyFrom, historyMaxAmount, historyMinAmount, historyQ, historyStatus, historyTo, historyType, statementMonth]);

  const fetchHistory = useCallback(async (reset: boolean) => {
    if (!accountNumber) return;
    if (historyLoading) return;
    setHistoryLoading(true);
    setError(null);
    try {
      const url = buildTxUrl({ limit: 50, cursor: reset ? null : historyCursor });
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data: any = await readJson(res);
      const txs = Array.isArray(data?.transactions) ? data.transactions : [];
      const next = typeof data?.next_cursor === "string" ? data.next_cursor : null;
      if (!res.ok) {
        setError(data?.error || t("user.operation_failed"));
        if (reset) {
          setHistoryTransactions([]);
          setHistoryCursor(null);
        }
        return;
      }
      if (reset) {
        setHistoryTransactions(txs);
      } else {
        setHistoryTransactions((prev) => [...prev, ...txs]);
      }
      setHistoryCursor(next);
    } catch (e: any) {
      setError(e?.message || t("user.operation_failed"));
      if (reset) {
        setHistoryTransactions([]);
        setHistoryCursor(null);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, [accountNumber, buildTxUrl, historyCursor, historyLoading, readJson, t]);

  const didInitialLoad = useRef(false);

  useEffect(() => {
    didInitialLoad.current = false;
    setHistoryTransactions([]);
    setHistoryCursor(null);
  }, [accountNumber]);

  useEffect(() => {
    if (loading || !accountNumber) return;
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    fetchHistory(true);
  }, [accountNumber, fetchHistory, loading]);

  const openReceipt = (id: number) => {
    if (!accountNumber) return;
    const u = new URL("/api/transactions", window.location.origin);
    u.searchParams.set("account", accountNumber);
    u.searchParams.set("format", "receipt");
    u.searchParams.set("id", String(id));
    u.searchParams.set("autoprint", "1");
    window.open(u.toString(), "_blank", "noopener,noreferrer");
  };

  const exportCsv = () => {
    const url = buildTxUrl({ format: "csv", limit: 5000 });
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const printStatement = () => {
    const url = buildTxUrl({ format: "statement", limit: 20000, autoprint: true });
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <main>
      <Header />
      <section className="container" style={{ padding: 24, display: "grid", gap: 16 }}>
        <div className="toolbar" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0 }}>{t("tx.history")}</h1>
            <div className="muted">{accountNumber ? `${t("dash.account")}: ${accountNumber}` : t("inbox.loading")}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#5b667a" }}>
              {t("tx.statement_month")}
              <select value={statementMonth} onChange={(e) => setStatementMonth(e.target.value)} style={{ minWidth: 140 }}>
                {(() => {
                  const out: string[] = [];
                  const now = new Date();
                  for (let i = 0; i < 12; i++) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                  }
                  return out;
                })().map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn ghost" onClick={printStatement} disabled={historyLoading || loading}>
              {t("tx.print_statement")}
            </button>
            <button className="btn ghost" onClick={exportCsv} disabled={historyLoading || loading}>
              {t("tx.export_csv")}
            </button>
          </div>
        </div>

        {error && <div style={{ color: "#b00020" }}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
          <input placeholder={t("tx.search_placeholder")} value={historyQ} onChange={(e) => setHistoryQ(e.target.value)} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#5b667a" }}>
            {t("tx.from")}
            <input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#5b667a" }}>
            {t("tx.to")}
            <input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
          </label>
          <select value={historyType} onChange={(e) => setHistoryType(e.target.value)}>
            <option value="">{t("tx.type_all")}</option>
            <option value="deposit">Deposit</option>
            <option value="withdraw">Withdraw</option>
            <option value="transfer">Transfer</option>
          </select>
          <select value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)}>
            <option value="">{t("tx.status_all")}</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Voided">Voided</option>
          </select>
          <select value={historyDirection} onChange={(e) => setHistoryDirection(e.target.value)}>
            <option value="">{t("tx.direction_all")}</option>
            <option value="in">{t("tx.direction_in")}</option>
            <option value="out">{t("tx.direction_out")}</option>
          </select>
          <input inputMode="decimal" placeholder={t("tx.min_amount")} value={historyMinAmount} onChange={(e) => setHistoryMinAmount(e.target.value)} />
          <input inputMode="decimal" placeholder={t("tx.max_amount")} value={historyMaxAmount} onChange={(e) => setHistoryMaxAmount(e.target.value)} />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn primary" onClick={() => fetchHistory(true)} disabled={historyLoading || loading}>
            {historyLoading ? t("inbox.loading") : t("tx.apply")}
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="table zebra">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Status</th>
                <th>Counterparty</th>
                <th>Amount</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {historyTransactions.map((tx) => {
                const src = String(tx.account_number ?? "");
                const trg = String(tx.target_account ?? "");
                const type = String(tx.type ?? "").toLowerCase();
                const isIncoming = (type === "deposit" && src === accountNumber) || (type === "transfer" && trg === accountNumber);
                const isOutgoing = (type === "withdraw" && src === accountNumber) || (type === "transfer" && src === accountNumber && trg !== accountNumber);
                const cp = type === "transfer" ? (isIncoming ? src : isOutgoing ? trg : "") : "";

                return (
                  <tr key={tx.id}>
                    <td>{tx.id}</td>
                    <td style={{ textTransform: "capitalize" }}>{tx.type}</td>
                    <td>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          backgroundColor: tx.status === "Completed" ? "#3f9c29" : tx.status === "Pending" ? "#ff9800" : "#f44336",
                          color: "white",
                        }}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td>{cp || "-"}</td>
                    <td className="num">
                      <PositiveMoney amount={isIncoming ? tx.amount : isOutgoing ? -tx.amount : tx.amount} className="num" />
                    </td>
                    <td>{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : "-"}</td>
                    <td>
                      <button className="btn ghost" onClick={() => openReceipt(tx.id)} style={{ padding: "6px 10px", fontSize: 12 }}>
                        {t("tx.receipt")}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!historyTransactions.length && (
                <tr>
                  <td colSpan={7} style={{ color: "#5b667a" }}>
                    {historyLoading || loading ? t("inbox.loading") : "No transactions found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={() => fetchHistory(false)} disabled={historyLoading || loading || !historyCursor}>
            {t("tx.load_more")}
          </button>
        </div>
      </section>
    </main>
  );
}
