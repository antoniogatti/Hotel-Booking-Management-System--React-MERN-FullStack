import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "./pnl-utils";

type Month = { month: string; income: number; expense: number };
type IncomeSource = { label: string; count: number; amount: number };

export default function AnalyticsDashboard({ year, months, sources, income, expense, bookingIncome, bookingCount }: {
  year: string;
  months: Month[];
  sources: IncomeSource[];
  income: number;
  expense: number;
  bookingIncome: number;
  bookingCount: number;
}) {
  const margin = income > 0 ? `${((income - expense) / income * 100).toFixed(1)}%` : "Not available";
  const average = bookingCount > 0 ? formatMoney(Math.round(bookingIncome / bookingCount)) : "Not available";

  return (
    <section aria-label="Business insights" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Business insights</h2>
        <p className="mt-1 text-sm text-slate-600">Based on the same included P&amp;L income and expenses for {year}. Income is assigned to the check-in month; additional income and expenses use their entry date.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Net margin</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{margin}</p>
          <p className="mt-1 text-xs text-slate-500">(Income minus expenses) / income</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Average booking income per included row</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{average}</p>
          <p className="mt-1 text-xs text-slate-500">{bookingCount} included booking income row{bookingCount === 1 ? "" : "s"}; additional income excluded</p>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-900">Monthly income and expenses</h3>
          <div className="mt-4 h-72" role="img" aria-label={`Monthly income and expenses for ${year}. Exact values are in the monthly figures table.`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value: number) => `€${value / 100}`} width={70} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#0f766e" />
                <Bar dataKey="expense" name="Expenses" fill="#e11d48" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold text-teal-700">Show monthly figures</summary>
            <div className="mt-3 overflow-x-auto">
              <table aria-label="Monthly P&L figures" className="w-full text-left">
                <thead><tr className="border-b border-slate-200"><th className="py-2">Month</th><th className="py-2 text-right">Income</th><th className="py-2 text-right">Expenses</th><th className="py-2 text-right">Net</th></tr></thead>
                <tbody>{months.map((month) => <tr key={month.month} className="border-b border-slate-100">
                  <th scope="row" className="py-2 font-medium">{month.month}</th><td className="py-2 text-right">{formatMoney(month.income)}</td><td className="py-2 text-right">{formatMoney(month.expense)}</td><td className="py-2 text-right">{formatMoney(month.income - month.expense)}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </details>
        </div>
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-900">Income by source</h3>
          <p className="mt-1 text-sm text-slate-500">Included income only. Recorded income is not automatically linked to a booking.</p>
          <div className="mt-4 overflow-x-auto">
            <table aria-label="Income by source" className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-slate-600"><th className="py-3">Source</th><th className="py-3 text-right">Rows</th><th className="py-3 text-right">Income</th></tr></thead>
              <tbody>{sources.map((source) => <tr key={source.label} className="border-b border-slate-100">
                <th scope="row" className="py-3 font-medium text-slate-800">{source.label}</th><td className="py-3 text-right">{source.count}</td><td className="py-3 text-right">{formatMoney(source.amount)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
