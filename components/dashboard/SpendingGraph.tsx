"use client";
import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
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
      
      const date = t.created_at ? new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Today';
      
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
    return (
      <div style={{ 
        padding: 40, 
        textAlign: 'center', 
        color: 'var(--muted)',
        background: 'linear-gradient(180deg, rgba(10,107,255,0.05) 0%, rgba(0,0,0,0) 100%)',
        borderRadius: 12,
        border: '1px dashed var(--border)'
      }}>
        {t('graph.no_data')}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 320, position: 'relative' }}>
      <ResponsiveContainer>
        <AreaChart
          data={data}
          margin={{
            top: 20,
            right: 10,
            left: 0,
            bottom: 5,
          }}
        >
          <defs>
            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#00f2ff" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff0055" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#ff0055" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.3} />
          <XAxis 
            dataKey="date" 
            stroke="var(--muted)" 
            fontSize={11} 
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis 
            stroke="var(--muted)" 
            fontSize={11} 
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `₱${value}`}
            dx={-5}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(15, 22, 40, 0.85)', 
              borderColor: 'rgba(255,255,255,0.1)', 
              color: '#fff',
              backdropFilter: 'blur(8px)',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
            itemStyle={{ fontSize: 13, fontWeight: 500 }}
            labelStyle={{ color: 'var(--muted)', marginBottom: 8, fontSize: 12 }}
            cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: 10 }}
            iconType="circle" 
          />
          <Area 
            type="monotone" 
            dataKey="income" 
            name={t('graph.income')} 
            stroke="#00f2ff" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorIncome)" 
            activeDot={{ r: 6, strokeWidth: 0, fill: '#00f2ff', filter: 'drop-shadow(0 0 8px #00f2ff)' }}
            animationDuration={1500}
          />
          <Area 
            type="monotone" 
            dataKey="expense" 
            name={t('graph.expense')} 
            stroke="#ff0055" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorExpense)" 
            activeDot={{ r: 6, strokeWidth: 0, fill: '#ff0055', filter: 'drop-shadow(0 0 8px #ff0055)' }}
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
