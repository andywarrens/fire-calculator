// FIRE projection engine — all nominal euros, no inflation.
//
// The whole model is one loop: each year the balance grows by the expected
// return, then we add that year's savings (income − expenses). Income and
// expenses come from whichever block covers the year. Blocks run back-to-back
// with adjustable durations; the final block runs until the goal is reached.

const MAX_YEARS = 100 // safety cap so an unreachable goal can't loop forever

// Returns the block active at a given (0-based) year offset from now.
// Once we run past the sum of all block durations, the last block persists.
function blockForYear(blocks, yearOffset) {
  let cursor = 0
  for (const block of blocks) {
    cursor += Number(block.durationYears) || 0
    if (yearOffset < cursor) return block
  }
  return blocks[blocks.length - 1]
}

// Build the year-by-year projection.
// Returns { series, fireYearOffset, fireAge, goalReached }.
//   series: [{ yearOffset, age, calendarYear, balance, propertyValue, netWorth }]
export function project({
  startingSavings,
  returnRate, // e.g. 0.06 for 6%
  goal,
  currentAge,
  currentYear,
  blocks,
  // Optional rental property. It appreciates on its own (illiquid, so it does
  // NOT count toward the goal while owned), then at the sale year its full
  // value converts to a cash lump sum in the invested balance — from which
  // point it compounds like the rest and does count. Its net rent flows into
  // savings each year it's owned and stops automatically at the sale.
  propertyValue = 0,
  propertyReturnRate = 0,
  sellAfterYears = null,
  rentalIncome = 0,
  rentGrowthRate = 0, // annual rent indexation, e.g. 0.02
  loanAmount = 0,
  horizonYears = 0, // simulate at least this many years (to fill the chart)
}) {
  const series = []
  let balance = Number(startingSavings) || 0
  let prop = Number(propertyValue) || 0
  let sold = false
  let fireYearOffset = null
  const sellYear = sellAfterYears === null ? null : Number(sellAfterYears)
  let rentCurrent = Number(rentalIncome) || 0
  const rentGrowth = Number(rentGrowthRate) || 0
  // Outstanding loan on the property. Held flat (interest assumed covered
  // inside the net rent), then repaid in full from the sale proceeds.
  let loanOutstanding = Number(loanAmount) || 0

  // Decomposition of the balance for the stacked composition chart. These three
  // always sum to `balance`:
  //   contributed  — initial savings + cumulative net saved (income − expenses
  //                  + rent). The principal you put in.
  //   saleProceeds — the property lump sum, once sold.
  //   growth       — everything else, i.e. all compounded investment returns
  //                  (including returns earned on the sale proceeds).
  let contributed = Number(startingSavings) || 0
  let saleProceeds = 0

  // At the sale year the property's full value lands in the invested balance
  // and the asset is gone thereafter.
  const sellIfDue = (y) => {
    if (!sold && sellYear !== null && y === sellYear) {
      // Net cash from the sale = appreciated value minus the loan you repay.
      const net = prop - loanOutstanding
      balance += net
      saleProceeds += net
      prop = 0
      loanOutstanding = 0
      sold = true
    }
  }

  const record = (y) => {
    series.push({
      yearOffset: y,
      age: currentAge + y,
      calendarYear: currentYear + y,
      balance,
      propertyValue: prop,
      // Property counts toward net worth at its equity (value − outstanding
      // loan), so the line doesn't jump when the loan is repaid at the sale.
      netWorth: balance + prop - loanOutstanding,
      contributed,
      saleProceeds,
      growth: balance - contributed - saleProceeds,
    })
  }

  // Year 0 = today's snapshot before any growth/contribution.
  sellIfDue(0)
  record(0)
  if (goal > 0 && balance >= goal) fireYearOffset = 0

  for (let y = 1; y <= MAX_YEARS; y++) {
    const block = blockForYear(blocks, y - 1)
    const income = Number(block?.annualIncome) || 0
    const expenses = Number(block?.annualExpenses) || 0
    // Rent is earned every year the property is still owned; it stops the year
    // it's sold.
    const rentThisYear = sold ? 0 : rentCurrent
    const net = income - expenses + rentThisYear

    balance = balance * (1 + returnRate) + net
    contributed += net
    rentCurrent = rentCurrent * (1 + rentGrowth) // index rent for next year
    if (!sold) prop = prop * (1 + propertyReturnRate)
    sellIfDue(y)

    record(y)

    if (fireYearOffset === null && goal > 0 && balance >= goal) {
      fireYearOffset = y
    }

    // Run past the FIRE crossing (so the curve clearly crosses the goal line)
    // and a few years past the sale (so the lump sum AND the faster growth it
    // produces afterwards are both visible on the charts).
    if (
      fireYearOffset !== null &&
      y >= fireYearOffset + 3 &&
      (sellYear === null || y >= sellYear + 3) &&
      y >= horizonYears
    ) {
      break
    }
  }

  const goalReached = fireYearOffset !== null
  return {
    series,
    fireYearOffset,
    fireAge: goalReached ? currentAge + fireYearOffset : null,
    fireCalendarYear: goalReached ? currentYear + fireYearOffset : null,
    goalReached,
  }
}
