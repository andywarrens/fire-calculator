import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceDot,
} from 'recharts'
import { project } from './fire.js'
import {
  loadScenarios,
  saveScenario,
  deleteScenario,
  mostRecent,
} from './storage.js'

const CURRENT_YEAR = 2026
const CHART_YEARS = 20 // fixed chart window: current age → current age + 20
const RENT_INDEXATION_PCT = 2 // rent grows this much per year (fixed, not a control)

const euro = (n) =>
  new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Math.round(n))

const compact = (n) =>
  new Intl.NumberFormat('en-IE', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)

// A labelled range slider with a live value readout. `format` renders the
// current value (e.g. as euros, years, percent). The filled portion of the
// track is an inline gradient computed from the value.
function RangeField({ label, value, onChange, min, max, step = 1, format }) {
  const v = Number(value) || 0
  const pct = max > min ? ((v - min) / (max - min)) * 100 : 0
  return (
    <div className="field">
      <div className="field-head">
        <label>{label}</label>
        <span className="val">{format ? format(v) : v}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, var(--accent-dim) ${pct}%, var(--line) ${pct}%)`,
        }}
      />
    </div>
  )
}

const yrs = (v) => `${v} ${v === 1 ? 'yr' : 'yrs'}`
const pctFmt = (v) => `${v}%`

let nextId = 3
// Income/expenses are entered per month; converted to yearly when fed to the
// engine (which works in annual terms).
const initialBlocks = [
  { id: 1, durationYears: 5, monthlyIncome: 4000, monthlyExpenses: 2500 },
  { id: 2, durationYears: 5, monthlyIncome: 3000, monthlyExpenses: 2500 },
]

// Keep the block-id counter ahead of any loaded blocks so new blocks can't
// collide with restored ones.
function syncNextId(bs) {
  const max = bs.reduce((m, b) => Math.max(m, Number(b.id) || 0), 0)
  nextId = max + 1
}

export default function App() {
  const [startingSavings, setStartingSavings] = useState(50000)
  const [returnPct, setReturnPct] = useState(7)
  const [goal, setGoal] = useState(750000)
  const [currentAge, setCurrentAge] = useState(40)
  const [propertyEnabled, setPropertyEnabled] = useState(true)
  const [propertyValue, setPropertyValue] = useState(250000)
  const [propertyPct, setPropertyPct] = useState(3)
  const [sellAfterYears, setSellAfterYears] = useState(10)
  const [rentalIncomeMonthly, setRentalIncomeMonthly] = useState(800)
  const [loanAmount, setLoanAmount] = useState(150000)
  const [blocks, setBlocks] = useState(initialBlocks)

  // Saved scenarios (localStorage).
  const [scenarios, setScenarios] = useState([])
  const [scenarioName, setScenarioName] = useState('')

  // Gather every user-editable input into one serialisable object.
  const collectState = () => ({
    startingSavings,
    returnPct,
    goal,
    currentAge,
    propertyEnabled,
    propertyValue,
    propertyPct,
    sellAfterYears,
    rentalIncomeMonthly,
    loanAmount,
    blocks,
  })

  // Apply a saved state object back onto the inputs (each field guarded so a
  // partial/old save still loads cleanly).
  const applyState = (s) => {
    if (!s) return
    if (s.startingSavings !== undefined) setStartingSavings(s.startingSavings)
    if (s.returnPct !== undefined) setReturnPct(s.returnPct)
    if (s.goal !== undefined) setGoal(s.goal)
    if (s.currentAge !== undefined) setCurrentAge(s.currentAge)
    if (s.propertyEnabled !== undefined) setPropertyEnabled(s.propertyEnabled)
    if (s.propertyValue !== undefined) setPropertyValue(s.propertyValue)
    if (s.propertyPct !== undefined) setPropertyPct(s.propertyPct)
    if (s.sellAfterYears !== undefined) setSellAfterYears(s.sellAfterYears)
    if (s.rentalIncomeMonthly !== undefined)
      setRentalIncomeMonthly(s.rentalIncomeMonthly)
    if (s.loanAmount !== undefined) setLoanAmount(s.loanAmount)
    if (Array.isArray(s.blocks) && s.blocks.length) {
      setBlocks(s.blocks)
      syncNextId(s.blocks)
    }
  }

  // On first load: pull saved scenarios and auto-apply the most recent.
  useEffect(() => {
    const list = loadScenarios()
    setScenarios(list)
    const recent = mostRecent(list)
    if (recent) {
      applyState(recent.state)
      setScenarioName(recent.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaveScenario = () => {
    const name = scenarioName.trim() || `Scenario ${new Date().toLocaleDateString()}`
    const list = saveScenario(name, collectState(), new Date().toISOString())
    setScenarios(list)
    setScenarioName(name)
  }

  const handleLoadScenario = (name) => {
    const s = scenarios.find((x) => x.name === name)
    if (s) {
      applyState(s.state)
      setScenarioName(name)
    }
  }

  const handleDeleteScenario = () => {
    if (!scenarioName) return
    const list = deleteScenario(scenarioName)
    setScenarios(list)
  }

  const savedNames = scenarios.map((s) => s.name)
  const selectValue = savedNames.includes(scenarioName) ? scenarioName : ''

  const updateBlock = (id, patch) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))

  const addBlock = () =>
    setBlocks((bs) => {
      const last = bs[bs.length - 1]
      return [
        ...bs,
        {
          id: nextId++,
          durationYears: 5,
          monthlyIncome: last ? last.monthlyIncome : 4000,
          monthlyExpenses: last ? last.monthlyExpenses : 2500,
        },
      ]
    })

  const removeBlock = (id) =>
    setBlocks((bs) => (bs.length > 1 ? bs.filter((b) => b.id !== id) : bs))

  const result = useMemo(
    () =>
      project({
        // Your current savings/investments seed the balance at year 0.
        startingSavings: Number(startingSavings) || 0,
        returnRate: (Number(returnPct) || 0) / 100,
        goal: Number(goal) || 0,
        currentAge: Number(currentAge) || 0,
        currentYear: CURRENT_YEAR,
        // Monthly inputs → annual for the engine.
        blocks: blocks.map((b) => ({
          durationYears: b.durationYears,
          annualIncome: (Number(b.monthlyIncome) || 0) * 12,
          annualExpenses: (Number(b.monthlyExpenses) || 0) * 12,
        })),
        // When the property is toggled off, feed the engine nothing for it.
        propertyValue: propertyEnabled ? Number(propertyValue) || 0 : 0,
        propertyReturnRate: (Number(propertyPct) || 0) / 100,
        sellAfterYears: Number(sellAfterYears) || 0,
        rentalIncome: propertyEnabled ? (Number(rentalIncomeMonthly) || 0) * 12 : 0,
        rentGrowthRate: RENT_INDEXATION_PCT / 100,
        loanAmount: propertyEnabled ? Number(loanAmount) || 0 : 0,
        horizonYears: CHART_YEARS,
      }),
    [propertyEnabled, startingSavings, returnPct, goal, currentAge, propertyValue, propertyPct, sellAfterYears, rentalIncomeMonthly, loanAmount, blocks],
  )

  const { series, goalReached, fireAge, fireYearOffset, fireCalendarYear } = result

  // 4% safe-withdrawal-rule readout, based on the goal amount.
  const annualWithdrawal = (Number(goal) || 0) * 0.04
  const monthlyWithdrawal = annualWithdrawal / 12

  // Sanity check: does the 4% allowance cover the expenses of the final block?
  const finalExpenses = (Number(blocks[blocks.length - 1]?.monthlyExpenses) || 0) * 12
  const withdrawalCovers = annualWithdrawal >= finalExpenses

  const fireDot = goalReached
    ? series.find((p) => p.yearOffset === fireYearOffset)
    : null

  // Rental property: only overlay the net-worth line and sale marker when the
  // property is enabled.
  const hasProperty = propertyEnabled
  const saleAge = (Number(currentAge) || 0) + (Number(sellAfterYears) || 0)
  const netWorthAtFire = fireDot ? fireDot.netWorth : null

  // Earliest point where *total net worth incl. property* (the blue line)
  // reaches the goal — earlier than invested-only, since it counts home equity.
  const netWorthFire =
    (Number(goal) || 0) > 0
      ? series.find((p) => p.netWorth >= (Number(goal) || 0))
      : null

  // Fixed chart window: current age → current age + 20.
  const minAge = Number(currentAge) || 0
  const maxAge = minAge + CHART_YEARS
  const chartData = series.filter((p) => p.age <= maxAge)

  // Cumulative duration label for each block (e.g. "years 0–5").
  let cursor = 0
  const blockRanges = blocks.map((b) => {
    const start = cursor
    cursor += Number(b.durationYears) || 0
    return { start, end: cursor }
  })

  return (
    <div className="app">
      <h1>🔥 FIRE Calculator</h1>
      <p className="subtitle">
        When can you retire? Model your income &amp; expenses in adjustable
        blocks and watch your savings compound toward your goal.
      </p>

      <div className="scenarios">
        <input
          className="scenario-name"
          type="text"
          placeholder="Scenario name…"
          value={scenarioName}
          onChange={(e) => setScenarioName(e.target.value)}
        />
        <button className="btn-sm" onClick={handleSaveScenario}>
          Save
        </button>
        {scenarios.length > 0 && (
          <>
            <select
              className="scenario-select"
              value={selectValue}
              onChange={(e) => handleLoadScenario(e.target.value)}
            >
              <option value="">Load scenario…</option>
              {scenarios.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} — {new Date(s.savedAt).toLocaleDateString()}
                </option>
              ))}
            </select>
            <button
              className="icon-btn"
              onClick={handleDeleteScenario}
              disabled={!selectValue}
              title="Delete selected scenario"
            >
              ✕
            </button>
          </>
        )}
      </div>

      <div className="layout">
        {/* ---- Inputs ---- */}
        <div>
          <div className="panel" style={{ marginBottom: 16 }}>
            <h2>Your situation</h2>
            <RangeField
              label="Current savings / investments (€)"
              value={startingSavings}
              onChange={setStartingSavings}
              min={0}
              max={500000}
              step={500}
              format={euro}
            />
            <RangeField
              label="Current age"
              value={currentAge}
              onChange={setCurrentAge}
              min={18}
              max={60}
              step={1}
            />
            <RangeField
              label="Expected return (%/yr)"
              value={returnPct}
              onChange={setReturnPct}
              min={0}
              max={12}
              step={0.5}
              format={pctFmt}
            />
            <RangeField
              label="Goal amount (€)"
              value={goal}
              onChange={setGoal}
              min={100000}
              max={3000000}
              step={10000}
              format={euro}
            />
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head">
              <h2>Rental property</h2>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={propertyEnabled}
                  onChange={(e) => setPropertyEnabled(e.target.checked)}
                />
                <span>{propertyEnabled ? 'On' : 'Off'}</span>
              </label>
            </div>
            {propertyEnabled && (
              <>
                <p className="hint">
              Appreciates on its own and stays out of the 4% rule while you own
              it, then the equity (value − loan) converts to cash in your
              invested pot when sold. Net rent is added to savings each year and
              stops automatically at the sale — so don't also put this rent in
              your income blocks. Rent is indexed 2%/yr.
            </p>
            <RangeField
              label="Current value (€)"
              value={propertyValue}
              onChange={setPropertyValue}
              min={0}
              max={1000000}
              step={5000}
              format={euro}
            />
            <RangeField
              label="Outstanding loan (€)"
              value={loanAmount}
              onChange={setLoanAmount}
              min={0}
              max={500000}
              step={5000}
              format={euro}
            />
            <RangeField
              label="Net rent (€/mo, indexed 2%/yr)"
              value={rentalIncomeMonthly}
              onChange={setRentalIncomeMonthly}
              min={0}
              max={5000}
              step={25}
              format={euro}
            />
            <RangeField
              label="Appreciation (%/yr)"
              value={propertyPct}
              onChange={setPropertyPct}
              min={0}
              max={8}
              step={0.5}
              format={pctFmt}
            />
            <RangeField
              label="Sell after"
              value={sellAfterYears}
              onChange={setSellAfterYears}
              min={0}
              max={40}
              step={1}
              format={yrs}
            />
              </>
            )}
          </div>

          <div className="panel">
            <h2>Income / expense blocks</h2>
            {blocks.map((b, i) => (
              <div className="block" key={b.id}>
                <div className="block-head">
                  <span className="title">Block {i + 1}</span>
                  <span className="years">
                    years {blockRanges[i].start}–{blockRanges[i].end}
                    {i === blocks.length - 1 ? '+ (until goal)' : ''}
                  </span>
                  <button
                    className="icon-btn"
                    onClick={() => removeBlock(b.id)}
                    disabled={blocks.length <= 1}
                    title="Remove block"
                  >
                    ✕
                  </button>
                </div>
                <RangeField
                  label="Duration"
                  value={b.durationYears}
                  onChange={(v) => updateBlock(b.id, { durationYears: v })}
                  min={1}
                  max={40}
                  step={1}
                  format={yrs}
                />
                <RangeField
                  label="Income (€/mo)"
                  value={b.monthlyIncome}
                  onChange={(v) => updateBlock(b.id, { monthlyIncome: v })}
                  min={0}
                  max={18000}
                  step={50}
                  format={euro}
                />
                <RangeField
                  label="Expenses (€/mo)"
                  value={b.monthlyExpenses}
                  onChange={(v) => updateBlock(b.id, { monthlyExpenses: v })}
                  min={0}
                  max={10000}
                  step={50}
                  format={euro}
                />
              </div>
            ))}
            <button className="btn" onClick={addBlock}>
              + Add block
            </button>
          </div>
        </div>

        {/* ---- Results + chart ---- */}
        <div className="panel">
          <div className="result">
            {goalReached ? (
              <span className="headline ok">
                🎉 FIRE at age {fireAge} — in {fireYearOffset}{' '}
                {fireYearOffset === 1 ? 'year' : 'years'} ({fireCalendarYear})
              </span>
            ) : (
              <span className="headline bad">
                Goal not reached within 100 years — try higher income, lower
                expenses, or a higher return.
              </span>
            )}
            {hasProperty && goalReached && (
              <span className="subnote">
                Net worth incl. property at FIRE: {euro(netWorthAtFire)}
              </span>
            )}
            {hasProperty && netWorthFire && (
              <span className="subnote">
                Earliest FIRE by net worth incl. property (blue line): age{' '}
                {netWorthFire.age} ({netWorthFire.calendarYear})
              </span>
            )}
          </div>

          <div className="stats">
            <div className="stat">
              <div className="k">Goal</div>
              <div className="v">{euro(Number(goal) || 0)}</div>
              <div className="note">target net worth</div>
            </div>
            <div className="stat">
              <div className="k">4% rule / year</div>
              <div className={`v ${withdrawalCovers ? 'ok' : 'bad'}`}>
                {euro(annualWithdrawal)}
              </div>
              <div className="note">
                {withdrawalCovers ? 'covers' : 'below'} final expenses{' '}
                {euro(finalExpenses)}
              </div>
            </div>
            <div className="stat">
              <div className="k">4% rule / month</div>
              <div className="v">{euro(monthlyWithdrawal)}</div>
              <div className="note">safe monthly spend</div>
            </div>
          </div>

          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 16, right: 24, bottom: 8, left: 8 }}
              >
                <CartesianGrid stroke="#2a3a4d" strokeDasharray="3 3" />
                <XAxis
                  dataKey="age"
                  type="number"
                  domain={[minAge, maxAge]}
                  allowDataOverflow
                  tickCount={6}
                  stroke="#8b9bad"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: 'age',
                    position: 'insideBottomRight',
                    offset: -4,
                    fill: '#8b9bad',
                    fontSize: 12,
                  }}
                />
                <YAxis
                  domain={[0, 1000000]}
                  allowDataOverflow
                  stroke="#8b9bad"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => '€' + compact(v)}
                  width={64}
                />
                <Tooltip
                  contentStyle={{
                    background: '#16212e',
                    border: '1px solid #2a3a4d',
                    borderRadius: 8,
                    color: '#e6edf3',
                  }}
                  formatter={(v, name) => [euro(v), name]}
                  labelFormatter={(age) => `Age ${age}`}
                />
                {hasProperty && <Legend wrapperStyle={{ fontSize: 12 }} />}
                <ReferenceLine
                  y={Number(goal) || 0}
                  stroke="#fbbf24"
                  strokeDasharray="5 4"
                  label={{
                    value: 'goal',
                    fill: '#fbbf24',
                    fontSize: 12,
                    position: 'insideTopLeft',
                  }}
                />
                {hasProperty && saleAge > (Number(currentAge) || 0) && (
                  <ReferenceLine
                    x={saleAge}
                    stroke="#60a5fa"
                    strokeDasharray="3 3"
                    label={{
                      value: 'sell',
                      fill: '#60a5fa',
                      fontSize: 12,
                      position: 'top',
                    }}
                  />
                )}
                {/* Net worth (invested + property) drawn under the invested
                    line; the two converge at the sale year. */}
                {hasProperty && (
                  <Line
                    type="monotone"
                    dataKey="netWorth"
                    name="Net worth (incl. property)"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="balance"
                  name="Invested"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  dot={false}
                />
                {fireDot && (
                  <ReferenceDot
                    x={fireDot.age}
                    y={fireDot.balance}
                    r={6}
                    fill="#34d399"
                    stroke="#05231a"
                    strokeWidth={2}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Composition: what the invested balance is made of each year —
              saved capital (base), the property sale lump sum (once sold), and
              compounded investment growth on top. The three stack to the total
              balance, and growth visibly accelerates after the sale. */}
          <div className="chart-title">Where the balance comes from</div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 16, right: 24, bottom: 8, left: 8 }}
              >
                <CartesianGrid stroke="#2a3a4d" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="age" stroke="#8b9bad" tick={{ fontSize: 12 }} />
                <YAxis
                  domain={[0, 1000000]}
                  allowDataOverflow
                  stroke="#8b9bad"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => '€' + compact(v)}
                  width={64}
                />
                <Tooltip
                  contentStyle={{
                    background: '#16212e',
                    border: '1px solid #2a3a4d',
                    borderRadius: 8,
                    color: '#e6edf3',
                  }}
                  formatter={(v, name) => [euro(v), name]}
                  labelFormatter={(age) => `Age ${age}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="contributed"
                  name="Saved capital"
                  stackId="a"
                  fill="#64748b"
                />
                {hasProperty && (
                  <Bar
                    dataKey="saleProceeds"
                    name="Property sale"
                    stackId="a"
                    fill="#a78bfa"
                  />
                )}
                <Bar
                  dataKey="growth"
                  name="Investment growth"
                  stackId="a"
                  fill="#34d399"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <footer className="app-footer">
        <a
          href="https://github.com/andywarrens/fire-calculator"
          target="_blank"
          rel="noopener noreferrer"
        >
          Source on GitHub ↗
        </a>
      </footer>
    </div>
  )
}
