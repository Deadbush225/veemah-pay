"use client";
import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useLanguage } from '@/components/ui/LanguageProvider';

type Transaction = {
  id: number;
  type: string;
  status: string;
  amount: number;
  created_at?: string;
};

type Props = {
  transactions: Transaction[];
};

export function SpendingGraph({ transactions }: Props) {
  const { t } = useLanguage();
  const data = useMemo(() => {
    // Group by date (YYYY-MM-DD)
    const grouped: Record<string, { date: string; income: number; expense: number }> = {};

    transactions.forEach(t => {
      if (t.status !== 'Completed') return;
      
      const date = t.created_at ? new Date(t.created_at).toLocaleDateString() : 'Today';
      
      if (!grouped[date]) {
        grouped[date] = { date, income: 0, expense: 0 };
      }

      const amt = Number(t.amount);
      if (t.type === 'deposit') {
        grouped[date].income += amt;
      } else if (t.type === 'withdraw' || t.type === 'transfer') {
        grouped[date].expense += amt;
      }
    });

    // Convert to array and sort by date
    return Object.values(grouped).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions]);

  if (data.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>{t('graph.no_data')}</div>;
  }

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" stroke="var(--muted)" fontSize={12} />
          <YAxis stroke="var(--muted)" fontSize={12} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
            itemStyle={{ color: 'var(--text)' }}
          />
          <Legend />
          <Bar dataKey="income" name={t('graph.income')} fill="var(--success)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name={t('graph.expense')} fill="var(--danger)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
