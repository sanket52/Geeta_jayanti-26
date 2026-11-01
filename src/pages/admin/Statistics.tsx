import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const monthlyRegistrations = [
  { month: "Apr", count: 0 }, { month: "May", count: 0 }, { month: "Jun", count: 0 },
  { month: "Jul", count: 1 }, { month: "Aug", count: 4 }, { month: "Sep", count: 12 },
];

const genderData = [
  { name: "Male", value: 7, color: "#8B1A1A" },
  { name: "Female", value: 5, color: "#C8902B" },
  { name: "Other", value: 0, color: "#F2E4CC" },
];

const ageGroupData = [
  { group: "Junior (10–14)", count: 5 },
  { group: "Senior (15–18)", count: 4 },
  { group: "Youth (19–25)", count: 3 },
];

const stateData = [
  { state: "Uttar Pradesh", count: 3 },
  { state: "Madhya Pradesh", count: 2 },
  { state: "Rajasthan", count: 1 },
  { state: "Bihar", count: 1 },
  { state: "Gujarat", count: 1 },
  { state: "Delhi", count: 1 },
  { state: "Haryana", count: 1 },
  { state: "Others", count: 2 },
];

const donationData = [
  { month: "Apr", amount: 1200 }, { month: "May", amount: 2400 }, { month: "Jun", amount: 1800 },
  { month: "Jul", amount: 3200 }, { month: "Aug", amount: 4500 }, { month: "Sep", amount: 6800 },
];

const CHART_OPTS = {
  tooltip: { contentStyle: { background: "#FDF6EE", border: "1px solid #C8902B", borderRadius: 8, fontSize: 12 }, labelStyle: { color: "#2C1508", fontWeight: 600 } },
  grid: { strokeDasharray: "3 3", stroke: "#F2E4CC" },
  tick: { fontSize: 11, fill: "#6B4226" },
};

export default function AdminStatistics() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ fontFamily: "var(--font-display)" }} className="text-2xl font-bold text-brown">Analytics & Statistics</h1>
          <p className="text-sm text-brown-mid">Vedic Knowledge Competition 2026 — Live Dashboard</p>
        </div>
        <button className="px-4 py-2 bg-maroon text-cream rounded-lg font-semibold text-sm hover:bg-maroon-dark transition-colors">
          ⬇ Export Report
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Testing Records", value: "12", icon: "👥" },
          { label: "States Covered", value: "9", icon: "🗺" },
          { label: "Test Donations", value: "₹19.9K", icon: "💰" },
          { label: "Avg Score (prev)", value: "62.4%", icon: "📊" },
          { label: "Certificates Issued", value: "10", icon: "🏅" },
        ].map((s) => (
          <div key={s.label} className="bg-cream border border-cream-dark rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-xl font-bold text-maroon">{s.value}</div>
            <div className="text-xs text-brown-mid">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Registration Over Time */}
      <div className="bg-cream border border-cream-dark rounded-2xl p-6">
        <h3 style={{ fontFamily: "var(--font-display)" }} className="font-bold text-brown mb-5">Monthly Registration Trend</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={monthlyRegistrations}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B1A1A" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#8B1A1A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...CHART_OPTS.grid} />
            <XAxis dataKey="month" tick={CHART_OPTS.tick} />
            <YAxis tick={CHART_OPTS.tick} />
            <Tooltip {...CHART_OPTS.tooltip} />
            <Area type="monotone" dataKey="count" stroke="#8B1A1A" strokeWidth={2.5} fill="url(#areaGrad)" name="Registrations" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gender Pie */}
        <div className="bg-cream border border-cream-dark rounded-2xl p-6">
          <h3 style={{ fontFamily: "var(--font-display)" }} className="font-bold text-brown mb-4">Gender Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={genderData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {genderData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip {...CHART_OPTS.tooltip} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {genderData.map((g) => (
              <div key={g.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />
                <span className="text-brown-mid">{g.name} ({Math.round(g.value / 12 * 100)}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Age Group */}
        <div className="bg-cream border border-cream-dark rounded-2xl p-6">
          <h3 style={{ fontFamily: "var(--font-display)" }} className="font-bold text-brown mb-4">Age Group Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ageGroupData} layout="vertical" barSize={18}>
              <CartesianGrid {...CHART_OPTS.grid} />
              <XAxis type="number" tick={CHART_OPTS.tick} />
              <YAxis type="category" dataKey="group" tick={{ fontSize: 9, fill: "#6B4226" }} width={90} />
              <Tooltip {...CHART_OPTS.tooltip} />
              <Bar dataKey="count" fill="#C8902B" radius={[0, 4, 4, 0]} name="Students" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donation Trend */}
        <div className="bg-cream border border-cream-dark rounded-2xl p-6">
          <h3 style={{ fontFamily: "var(--font-display)" }} className="font-bold text-brown mb-4">Monthly Donations (₹)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={donationData}>
              <CartesianGrid {...CHART_OPTS.grid} />
              <XAxis dataKey="month" tick={CHART_OPTS.tick} />
              <YAxis tick={CHART_OPTS.tick} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip {...CHART_OPTS.tooltip} formatter={(value) => [`₹${Number(value ?? 0).toLocaleString("en-IN")}`, "Donations"]} />
              <Line type="monotone" dataKey="amount" stroke="#E07820" strokeWidth={2.5} dot={{ fill: "#E07820", r: 4 }} name="Amount" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* State-wise Bar */}
      <div className="bg-cream border border-cream-dark rounded-2xl p-6">
        <h3 style={{ fontFamily: "var(--font-display)" }} className="font-bold text-brown mb-5">State-wise Registration Breakdown</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={stateData} barSize={32}>
            <CartesianGrid {...CHART_OPTS.grid} />
            <XAxis dataKey="state" tick={{ fontSize: 10, fill: "#6B4226" }} />
            <YAxis tick={CHART_OPTS.tick} />
            <Tooltip {...CHART_OPTS.tooltip} />
            <Bar dataKey="count" fill="#8B1A1A" radius={[4, 4, 0, 0]} name="Students" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Exam Statistics */}
      <div className="bg-cream border border-cream-dark rounded-2xl p-6">
        <h3 style={{ fontFamily: "var(--font-display)" }} className="font-bold text-brown mb-4">Examination Statistics (Previous Year — 2025)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Students Registered", value: "18", icon: "📋", color: "text-maroon" },
            { label: "Attempted Exam", value: "16", pct: "88.9%", icon: "✍", color: "text-gold" },
            { label: "Passed", value: "12", pct: "75%", icon: "✅", color: "text-green-700" },
            { label: "Average Score", value: "62.4%", icon: "📊", color: "text-saffron" },
          ].map((s) => (
            <div key={s.label} className="bg-cream-dark rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              {s.pct && <div className="text-xs text-brown-mid">{s.pct} of registered</div>}
              <div className="text-xs text-brown-mid mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
