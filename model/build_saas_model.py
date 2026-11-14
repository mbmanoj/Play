"""Battery-SaaS play: IPP buys battery on loan, startup supplies dispatch/forecast SaaS for a service fee + revenue share.
Sheets: Summary, README, Battery Sizing, IPP Cash Flow, Assumptions, Headcount, Revenue, Opex, Capex & WC, Cash Flow.
INR lakh unless stated. Y1..Y10 = FY2027..FY2036 in columns C..L."""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.comments import Comment

wb = Workbook()
YEARS = 10
YC = [get_column_letter(3 + i) for i in range(YEARS)]
FY = [f"FY{2027 + i}" for i in range(YEARS)]
BLUE = Font(name="Arial", color="0000FF", size=10); BLACK = Font(name="Arial", size=10)
GREEN = Font(name="Arial", color="008000", size=10); BOLD = Font(name="Arial", bold=True, size=10)
HDR = Font(name="Arial", bold=True, size=11, color="FFFFFF"); TITLE = Font(name="Arial", bold=True, size=14)
NOTE = Font(name="Arial", italic=True, size=9, color="666666")
HFILL = PatternFill("solid", fgColor="1F3864"); SFILL = PatternFill("solid", fgColor="D9E1F2"); YFILL = PatternFill("solid", fgColor="FFFF00")
NUM = '#,##0.0;(#,##0.0);-'; NUM0 = '#,##0;(#,##0);-'; NUM2 = '#,##0.00;(#,##0.00);-'; PCT = '0.0%'

def style_sheet(ws, widths):
    for col, w in widths.items(): ws.column_dimensions[col].width = w
    ws.sheet_view.showGridLines = False
def header_row(ws, row, label="INR lakh"):
    ws.cell(row=row, column=1, value=label).font = HDR; ws.cell(row=row, column=1).fill = HFILL
    ws.cell(row=row, column=2).fill = HFILL
    for i, fy in enumerate(FY):
        c = ws.cell(row=row, column=3 + i, value=fy); c.font = HDR; c.fill = HFILL; c.alignment = Alignment(horizontal="center")
def section(ws, row, text, ncols=2 + YEARS):
    ws.cell(row=row, column=1, value=text).font = BOLD
    for col in range(1, ncols + 1): ws.cell(row=row, column=col).fill = SFILL

class Sheet:
    """Row-builder with per-sheet key registry."""
    def __init__(self, ws, start_row):
        self.ws, self.row, self.rows = ws, start_row, {}
    def line(self, key, label, fn, fmt=NUM, bold=False, font=BLACK, note=None):
        self.rows[key] = self.row
        self.ws.cell(row=self.row, column=1, value=label).font = BOLD if bold else BLACK
        for i in range(YEARS):
            c = self.ws.cell(row=self.row, column=3 + i, value=fn(i)); c.number_format = fmt; c.font = BOLD if bold else font
        if note: self.ws.cell(row=self.row, column=13, value=note).font = NOTE
        self.row += 1
    def sec(self, text):
        section(self.ws, self.row, text); self.row += 1
    def ref(self, key, i): return f"{YC[i]}{self.rows[key]}"
    def xref(self, key, i):
        name = self.ws.title
        q = f"'{name}'" if " " in name or "&" in name else name
        return f"{q}!{YC[i]}{self.rows[key]}"

# ================================================================ Assumptions
A = wb.active; A.title = "Assumptions"
style_sheet(A, {"A": 62, "B": 14, **{c: 11 for c in YC}, "M": 62})
A["A1"] = "Assumptions — edit BLUE cells only. INR lakh (100 lakh = 1 crore)."; A["A1"].font = TITLE
A["A2"] = "Play: IPP buys the battery at market price on a loan and pays EMIs. We supply the SaaS (forecasting, when to store vs sell, exchange bidding, dispatch) for a fixed service fee plus a share of money earned."
A["A2"].font = Font(name="Arial", italic=True, size=10)
REF, SER = {}, {}
r = 4
def scalar(name, label, value, fmt=NUM, note=None, hl=False):
    global r
    A.cell(row=r, column=1, value=label).font = BLACK
    c = A.cell(row=r, column=2, value=value); c.font = BLUE; c.number_format = fmt
    if hl: c.fill = YFILL
    if note: A.cell(row=r, column=13, value=note).font = NOTE
    REF[name] = f"Assumptions!$B${r}"; r += 1
def series(name, label, values, fmt=NUM, note=None):
    global r
    A.cell(row=r, column=1, value=label).font = BLACK
    for i, v in enumerate(values):
        c = A.cell(row=r, column=3 + i, value=v); c.font = BLUE; c.number_format = fmt
    if note: A.cell(row=r, column=13, value=note).font = NOTE
    SER[name] = r; r += 1
def asec(t):
    global r
    section(A, r, t); r += 1
def ser(name, i): return f"Assumptions!${YC[i]}${SER[name]}"

header_row(A, 3, "Year series →")
asec("1. Customer ramp (each plant = 100 MW with a battery sized on the 'Battery Sizing' sheet)")
series("plants", "Plants under SaaS management, year-end (cumulative, net of churn)", [3, 8, 18, 32, 50, 70, 90, 110, 128, 145], NUM0,
       "~1,000 qualifying mid-size plants; FY31 = 5% share. Every customer has a battery (that is the product).")
scalar("churn", "Annual churn (share of prior-year plants lost)", 0.05, PCT)
scalar("plant_mw", "Plant size (MW)", 100, NUM0, "User instruction: 100 MW per plant.")

asec("2. Market prices & indices")
scalar("peak_price", "Evening peak exchange price, FY27 average over the peak window (INR/kWh)", 8.0, NUM2, "May 2026 peak INR 9.71 vs INR 10 cap; 4-hour average lower than the spike.")
scalar("noon_price", "Midday exchange price / opportunity cost of charging energy (INR/kWh)", 2.0, NUM2, "IEX solar capture rate ~INR 2.23 FY26; May 2026 trough INR 1.11.")
scalar("curtail_share", "Share of charging energy that would otherwise be curtailed (worth zero)", 0.20, PCT, "Rajasthan plants saw 8-50% curtailment in 2025.")
series("spread_idx", "Spread compression index (peak − noon gap vs FY27)", [1.0, 0.9, 0.8, 0.7, 0.6, 0.55, 0.5, 0.5, 0.5, 0.5], NUM,
       "ERCOT/NEM/GB precedent; IEX expects a 3-5 year merchant window.")
scalar("dsm_rate", "Plant deviation charges today (INR lakh per plant MW per year)", 0.90, NUM, "Solar ~INR 0.9 crore per 100 MW.")
series("dsm_idx", "Deviation-charge index (bands halved Apr 2026, X-factor to zero by FY31)", [1.0, 1.15, 1.3, 1.5, 1.7, 1.8, 1.9, 2.0, 2.0, 2.0], NUM)
scalar("dsm_recov", "Share of plant deviation charges avoided with battery + forecasting", 0.30, PCT, "Key untested assumption.")
series("grid_active", "Ancillary + capacity payments open to our aggregated batteries (1 = yes)", [0, 0, 0, 0, 1, 1, 1, 1, 1, 1], NUM0, "Regulatory risk: SRAS/TRAS to storage, capacity market staff paper Apr 2026.")
scalar("grid_per_mw", "Ancillary + capacity revenue per battery MW per year (INR lakh)", 5.0, NUM, "Illustrative.")

asec("3. Our pricing to the IPP")
scalar("fee_per_mw", "Fixed SaaS service fee (INR lakh per battery MW per year)", 1.2, NUM, "INR 10,000 per battery MW per month. ~3-4% of battery gross revenue in FY27.", hl=True)
scalar("share_arb", "Our share of gross battery revenue (arbitrage + grid services)", 0.10, PCT, "UK/Texas optimisers charge 10-20%; 10% plus the fixed fee leaves the IPP most of the uplift.", hl=True)
scalar("share_dsm", "Our share of deviation charges avoided", 0.25, PCT)
scalar("onboard_fee", "One-time onboarding & integration fee per plant (INR lakh)", 15, NUM, "SCADA/BMS integration, metering, exchange set-up.")
scalar("passive_capture", "Arbitrage the IPP captures alone with timer-based dispatch (share of optimised)", 0.70, PCT, "Timer dispatch misses real-time spikes, zero-price charging blocks and curtailment events. Used only for the 'without SaaS' comparison.")

asec("4. Battery capex, loan, tax (IPP side)")
scalar("capex_mwh", "Battery capex, market price (INR lakh per MWh, turnkey incl. PCS, BoP, civil)", 90, NUM, "INR 0.9 crore/MWh; 2025 tender bids imply 0.7-0.8. Cells are falling.", hl=True)
scalar("om_pct", "Battery O&M (% of capex per year)", 0.015, PCT)
scalar("ins_pct_b", "Battery insurance (% of capex per year)", 0.003, PCT)
scalar("debt_pct", "Debt share of battery capex", 0.70, PCT, "Lenders will not go higher without a revenue floor or capacity contract.")
scalar("debt_rate", "Loan interest rate", 0.10, PCT, "IREDA/PFC/bank term loan.")
scalar("debt_yrs", "Loan tenor (years, annual EMI)", 12, NUM0, "Storage term loans run 12-15 years.")
scalar("aug_year", "Augmentation year (add cells to restore capacity)", 7, NUM0)
scalar("aug_pct", "Augmentation cost (% of original capex)", 0.15, PCT, "Cells only, at year-7 prices.")
scalar("degrade", "Capacity degradation per year", 0.025, PCT)
scalar("wdv_rate", "Tax depreciation, written-down-value rate", 0.40, PCT, "40% WDV applies to listed renewable-energy devices; confirm BESS classification with a tax adviser. Use 0.15 if not.")
scalar("tax_rate", "Corporate tax rate (IPP and startup)", 0.2517, PCT)
scalar("ipp_shield", "IPP can use tax losses immediately against other income (1 = yes, 0 = carry forward)", 1, NUM0)
scalar("salvage_pct", "Salvage / continuing value of battery at end of year 10 (% of capex)", 0.10, PCT, "Battery life 12-15 years; conservative.")
scalar("disc_rate", "IPP equity discount rate for NPV", 0.14, PCT)

asec("5. Startup people")
scalar("sal_esc", "Annual salary escalation", 0.08, PCT)
scalar("emp_cost", "Employer statutory costs (% of salary)", 0.15, PCT)
series("founder_pay", "Founder compensation, each (INR lakh per year)", [48, 52, 56, 60.5, 65.3, 70.5, 76.2, 82.3, 88.8, 96], NUM, "INR 4 lakh/month from day 1 (user input), +8%/yr.")
scalar("n_founders", "Number of founders", 2, NUM0)
scalar("commission", "Sales commission (% of first-year revenue from new plants)", 0.05, PCT)
scalar("recruit_pct", "Recruitment cost (% of new hires' annual salary)", 0.08, PCT)
scalar("training", "Training & certifications per head per year (INR lakh)", 0.3, NUM)

asec("6. Startup office & admin")
scalar("cowork_seat", "Y1 co-working seat (INR lakh per seat per month)", 0.12, NUM)
scalar("sqft_head", "Office sq ft per head from Y2", 80, NUM0)
scalar("rent_sqft", "Rent INR per sq ft per month (Y2 price)", 85, NUM0)
scalar("rent_deposit_m", "Rent deposit (months)", 10, NUM0)
scalar("cam_pct", "CAM / maintenance (% of rent)", 0.15, PCT)
scalar("util_head", "Utilities & internet per head per month (INR lakh)", 0.015, '0.000')
scalar("consum_head", "Consumables, pantry, courier per head per month (INR lakh)", 0.025, '0.000')
scalar("cost_esc", "General cost escalation", 0.06, PCT)

asec("7. Startup technology & site")
scalar("cloud_base", "Cloud & compute base (INR lakh/yr)", 15, NUM)
scalar("cloud_plant", "Cloud & compute per plant (INR lakh/yr)", 2.0, NUM, "Higher than forecasting-only: real-time dispatch loop per battery.")
scalar("data_base", "Weather & market data subscriptions base (INR lakh/yr)", 25, NUM)
scalar("data_plant", "Data subscriptions per plant (INR lakh/yr)", 0.5, NUM)
scalar("sw_head", "Software licences & cybersecurity per head per year (INR lakh)", 0.6, NUM)
scalar("telecom_plant", "Site telemetry connectivity per plant per year (INR lakh)", 1.5, NUM, "Redundant links: dispatch commands cannot drop.")
scalar("site_hw", "Site hardware per new plant — capex (INR lakh)", 6.0, NUM, "Edge controller, RTU, BMS/PCS gateway, meter interface, UPS.")
scalar("site_install", "Site commissioning per new plant — opex (INR lakh)", 2.0, NUM)
scalar("laptop", "Laptop per new head — capex (INR lakh)", 1.0, NUM)
scalar("furniture", "Furniture per new head — capex (INR lakh)", 0.4, NUM)

asec("8. Startup vehicles & travel")
series("vehicles", "Owned field vehicles (cumulative)", [0, 2, 3, 4, 5, 6, 6, 6, 6, 6], NUM0)
scalar("veh_cost", "Vehicle cost (INR lakh)", 12, NUM); scalar("veh_fuel", "Fuel per vehicle per year (INR lakh)", 1.5, NUM)
scalar("veh_ins", "Insurance per vehicle per year (INR lakh)", 0.4, NUM); scalar("veh_maint", "Repairs & maintenance per vehicle per year (INR lakh)", 0.6, NUM)
scalar("cab_field", "Cabs per field engineer per month beyond owned vehicles (INR lakh)", 0.25, NUM)
scalar("cab_exec", "Cabs per founder/executive per month (INR lakh)", 0.10, NUM)
scalar("trip_cost", "Cost per domestic trip (INR lakh)", 0.19, NUM, "Flight 8,000 + 2 nights 8,000 + per diem 3,000.")
scalar("trips_sales", "Trips per salesperson per year", 48, NUM0); scalar("trips_field", "Trips per field/SCADA engineer per year", 72, NUM0)
scalar("trips_mgmt", "Trips per founder per year", 24, NUM0)

asec("9. Startup regulatory, legal, insurance, marketing, finance")
series("legal", "Legal & regulatory (INR lakh)", [30, 40, 50, 60, 70, 70, 70, 70, 70, 70], NUM)
series("audit", "Audit, accounting, CS, tax (INR lakh)", [8, 10, 15, 20, 25, 30, 30, 30, 30, 30], NUM)
scalar("ins_pct", "Insurance — E&O, D&O, cyber (% of revenue)", 0.0075, PCT, "We issue dispatch commands to INR 100+ crore assets; E&O cover is essential.")
scalar("ins_min", "Insurance minimum (INR lakh/yr)", 20, NUM)
series("marketing", "Marketing, conferences, PR (INR lakh)", [15, 20, 30, 40, 50, 60, 60, 60, 60, 60], NUM)
series("pilots", "Free pilots & shadow trials (INR lakh)", [25, 25, 10, 0, 0, 0, 0, 0, 0, 0], NUM)
scalar("sldc_fees", "SLDC/RLDC registration & scheduling fees (INR lakh/yr)", 5, NUM)
scalar("bank_pct", "Bank charges (% of revenue)", 0.002, PCT); scalar("baddebt_pct", "Bad debts (% of revenue)", 0.02, PCT)
scalar("contingency", "Contingency (% of opex)", 0.05, PCT)
scalar("recv_days", "Receivable days", 60, NUM0); scalar("pay_days", "Payable days", 30, NUM0)
scalar("int_rate", "Interest income on cash", 0.06, PCT)
series("equity", "Equity raised by startup (INR lakh)", [1200, 0, 2500, 0, 0, 0, 0, 0, 0, 0], NUM0, "Adjust so 'Lowest closing cash' on Cash Flow stays ≥ 0.")

# ================================================================ Battery Sizing
B = wb.create_sheet("Battery Sizing")
style_sheet(B, {"A": 60, "B": 13, "C": 13, "D": 13, "E": 13, "F": 13, "G": 13, "H": 13, "I": 13, "J": 50})
B["A1"] = "Battery sizing for one 100 MW plant — how much battery per MW to serve the evening peak reliably"; B["A1"].font = TITLE
B["A2"] = "Method: size usable capacity to the firm evening block, then gross up for depth of discharge, end-of-life capacity, and a weather carry-over buffer. Check feasibility month by month against seasonal and cloudy-day generation."
B["A2"].font = Font(name="Arial", italic=True, size=10)
BR = {}
br = 4
def b_in(name, label, value, fmt=NUM, note=None, hl=False):
    global br
    B.cell(row=br, column=1, value=label).font = BLACK
    c = B.cell(row=br, column=2, value=value); c.font = BLUE; c.number_format = fmt
    if hl: c.fill = YFILL
    if note: B.cell(row=br, column=10, value=note).font = NOTE
    BR[name] = f"'Battery Sizing'!$B${br}"; br += 1
def b_out(name, label, formula, fmt=NUM, note=None, bold=False):
    global br
    B.cell(row=br, column=1, value=label).font = BOLD if bold else BLACK
    c = B.cell(row=br, column=2, value=formula); c.font = BOLD if bold else BLACK; c.number_format = fmt
    if note: B.cell(row=br, column=10, value=note).font = NOTE
    BR[name] = f"'Battery Sizing'!$B${br}"; br += 1
section(B, br, "Inputs", 10); br += 1
b_in("cuf", "Plant capacity utilisation factor (annual)", 0.20, PCT, "Solar, good site.")
b_in("shift_share", "Share of plant energy available to shift into the peak (untied / merchant / curtailed)", 0.30, PCT, "Energy under a flat-tariff PPA earns nothing extra by shifting. 1.0 for a fully merchant plant.", hl=True)
b_in("peak_hours", "Evening peak window to serve (hours)", 4, NUM0, "18:00-22:00. Prices above INR 8 cluster here.")
b_in("target_mw", "Target firm delivery during the peak window (MW per 100 MW plant)", 25, NUM0, "Choose; the sheet reports reliability. Compare with the 'no-issue' MW below.", hl=True)
b_in("rte", "Round-trip efficiency (AC to AC)", 0.86, PCT, "LFP with PCS and transformer losses.")
b_in("dod", "Usable depth of discharge", 0.90, PCT)
b_in("eol_soh", "State of health the system must still meet target at (before augmentation)", 0.90, PCT, "Augmentation in year 7 restores capacity; sizing to 0.80 as well would double-count.")
b_in("weather_buf", "Weather carry-over buffer on capacity", 1.10, NUM2, "Extra room to store surplus on good days for the next cloudy evening.")
b_in("low_day", "Low-generation day as share of monthly average (P10 day)", 0.60, PCT, "Overcast / dust / haze.")
b_in("cloudy_share", "Share of days that are low-generation days", 0.10, PCT, "Higher in monsoon; averaged here.")
b_in("aux_load", "Auxiliary load & availability derate on delivered energy", 0.03, PCT, "HVAC, outages, maintenance.")
br += 1
section(B, br, "Derived sizing", 10); br += 1
b_out("daily_avg", "Average daily plant energy (MWh)", f"={REF['plant_mw']}*24*{BR['cuf']}")
b_out("block_mwh", "Energy to deliver per evening (MWh) = target MW × hours", f"={BR['target_mw']}*{BR['peak_hours']}")
b_out("charge_mwh", "Energy to charge per day (MWh) = block ÷ RTE", f"={BR['block_mwh']}/{BR['rte']}")
b_out("usable_eol", "Usable capacity required at end of life (MWh)", f"={BR['block_mwh']}/(1-{BR['aux_load']})")
b_out("nameplate", "NAMEPLATE BATTERY REQUIRED (MWh) = usable ÷ DoD ÷ EoL SoH × weather buffer", f"={BR['usable_eol']}/{BR['dod']}/{BR['eol_soh']}*{BR['weather_buf']}", bold=True)
b_out("pcs_mw", "Inverter (PCS) rating required (MW) = nameplate ÷ hours", f"={BR['nameplate']}/{BR['peak_hours']}", bold=True)
b_out("mwh_per_mw", "Battery MWh per MW of plant", f"={BR['nameplate']}/{REF['plant_mw']}", NUM2, bold=True)
b_out("mw_per_mw", "Battery MW per MW of plant", f"={BR['pcs_mw']}/{REF['plant_mw']}", NUM2, bold=True)
b_out("capex_plant", "Battery capex per plant (INR lakh)", f"={BR['nameplate']}*{REF['capex_mwh']}", bold=True)
br += 1
section(B, br, "Monthly feasibility (seasonality) — can the plant charge the block every day?", 10); br += 1
hdrs = ["Month", "Seasonal factor (edit)", "Avg daily plant MWh", "Shiftable MWh avg day", "Deliverable avg day (MWh)", "Shiftable MWh low day", "Deliverable low day (MWh)", "Days", "Delivered MWh in month"]
for j, h in enumerate(hdrs):
    c = B.cell(row=br, column=1 + j, value=h); c.font = HDR; c.fill = HFILL; c.alignment = Alignment(wrap_text=True, horizontal="center")
B.row_dimensions[br].height = 42
br += 1
months = [("Jan", 0.95, 31), ("Feb", 1.05, 28), ("Mar", 1.15, 31), ("Apr", 1.15, 30), ("May", 1.15, 31), ("Jun", 1.00, 30),
          ("Jul", 0.80, 31), ("Aug", 0.80, 31), ("Sep", 0.95, 30), ("Oct", 1.05, 31), ("Nov", 0.95, 30), ("Dec", 0.90, 31)]
m0 = br
for k, (m, f, d) in enumerate(months):
    row = m0 + k
    B.cell(row=row, column=1, value=m).font = BLACK
    c = B.cell(row=row, column=2, value=f); c.font = BLUE; c.number_format = NUM2
    B.cell(row=row, column=3, value=f"={BR['daily_avg']}*B{row}").number_format = NUM
    B.cell(row=row, column=4, value=f"=C{row}*{BR['shift_share']}").number_format = NUM
    B.cell(row=row, column=5, value=f"=MIN({BR['block_mwh']},D{row}*{BR['rte']})*(1-{BR['aux_load']})").number_format = NUM
    B.cell(row=row, column=6, value=f"=D{row}*{BR['low_day']}").number_format = NUM
    B.cell(row=row, column=7, value=f"=MIN({BR['block_mwh']},F{row}*{BR['rte']})*(1-{BR['aux_load']})").number_format = NUM
    c = B.cell(row=row, column=8, value=d); c.font = BLUE; c.number_format = NUM0
    B.cell(row=row, column=9, value=f"=H{row}*((1-{BR['cloudy_share']})*E{row}+{BR['cloudy_share']}*G{row})").number_format = NUM0
m_last = m0 + len(months) - 1
B.cell(row=m0, column=10, value="Seasonal factors: north-west India solar pattern (monsoon trough Jul-Aug). Replace with the plant's own P50 monthly profile.").font = NOTE
br = m_last + 1
B.cell(row=br, column=1, value="Annual").font = BOLD
B.cell(row=br, column=2, value=f"=SUMPRODUCT(B{m0}:B{m_last},H{m0}:H{m_last})/SUM(H{m0}:H{m_last})").number_format = NUM2
B.cell(row=br, column=8, value=f"=SUM(H{m0}:H{m_last})").number_format = NUM0
B.cell(row=br, column=9, value=f"=SUM(I{m0}:I{m_last})").number_format = NUM0
B.cell(row=br, column=9).font = BOLD
ANNUAL_ROW = br
br += 2
section(B, br, "Results", 10); br += 1
b_out("delivered_yr", "ENERGY DELIVERED INTO THE PEAK, YEAR 1 (MWh)", f"=I{ANNUAL_ROW}", NUM0, bold=True)
b_out("target_yr", "Target energy if the block were served every day (MWh)", f"={BR['block_mwh']}*H{ANNUAL_ROW}*(1-{BR['aux_load']})", NUM0)
b_out("availability", "Firm-block availability (share of target energy actually deliverable)", f"={BR['delivered_yr']}/{BR['target_yr']}", PCT, "Below ~95% means the target MW is too high for this plant's shiftable energy.", bold=True)
b_out("cycles", "Equivalent full cycles per year", f"={BR['delivered_yr']}/({BR['nameplate']}*{BR['dod']})", NUM0, "LFP tolerates 6,000+; one cycle a day is comfortable.")
b_out("worst_month_mw", "Firm MW achievable on an AVERAGE day of the worst month", f"=MIN(D{m0}:D{m_last})*{BR['rte']}*(1-{BR['aux_load']})/{BR['peak_hours']}", NUM, "Shiftable energy on an average July/August day.")
b_out("noissue_mw", "Firm MW achievable 'WITHOUT ANY ISSUE' (P10 low day in the worst month)", f"=MIN(F{m0}:F{m_last})*{BR['rte']}*(1-{BR['aux_load']})/{BR['peak_hours']}", NUM, "Sizing the firm promise to this number means essentially never failing the block.", bold=True)
b_out("noissue_nameplate", "Nameplate needed to back the 'no-issue' MW only (MWh)", f"={BR['noissue_mw']}*{BR['peak_hours']}/(1-{BR['aux_load']})/{BR['dod']}/{BR['eol_soh']}*{BR['weather_buf']}", NUM)
b_out("noissue_per_mw", "'No-issue' battery MWh per MW of plant", f"={BR['noissue_nameplate']}/{REF['plant_mw']}", NUM2, bold=True)
br += 1
B.cell(row=br, column=1, value="How to read: the chosen target gives the arbitrage-maximising battery; the 'no-issue' line is the firm promise you could make to a buyer or a capacity market with near-zero shortfall risk. Most owners will size to the first and sell firmness only up to the second.").font = Font(name="Arial", italic=True, size=9)
B.cell(row=br, column=1).alignment = Alignment(wrap_text=True); B.row_dimensions[br].height = 40

# ================================================================ IPP Cash Flow (per 100 MW plant)
I = wb.create_sheet("IPP Cash Flow")
style_sheet(I, {"A": 62, "B": 12, **{c: 12 for c in YC}, "M": 55})
I["A1"] = "One IPP's battery project — 100 MW plant, battery bought at market price on a loan, our SaaS running it (INR lakh)"; I["A1"].font = TITLE
I["A2"] = "Incremental to the plant: only the battery, its loan, the energy it shifts, and our fees. The plant's PPA income is unchanged and excluded."
I["A2"].font = Font(name="Arial", italic=True, size=10)
header_row(I, 4)
ip = Sheet(I, 5)
ip.sec("Battery & energy")
ip.line("cap", "Battery nameplate (MWh)", lambda i: f"={BR['nameplate']}", NUM0, font=GREEN)
ip.line("mw", "Battery power (MW)", lambda i: f"={BR['pcs_mw']}", NUM0, font=GREEN)
ip.line("soh", "State of health (capacity remaining)", lambda i: f"=(1-{REF['degrade']})^{i}" if i == 0 else f"=IF({i+1}>{REF['aug_year']},MIN(1,{YC[i-1]}{{soh}}*(1-{REF['degrade']})+IF({i+1}={REF['aug_year']}+1,{REF['aug_pct']},0)),{YC[i-1]}{{soh}}*(1-{REF['degrade']}))", PCT,
        note="Degrades 2.5%/yr; augmentation in the chosen year restores ~15 points.")
ip.line("usable", "Usable capacity this year (MWh) = nameplate × DoD × SoH ÷ weather buffer", lambda i: f"={ip.ref('cap', i)}*{BR['dod']}*{ip.ref('soh', i)}/{BR['weather_buf']}", NUM0)
ip.line("delivered", "Energy delivered into the peak (MWh)", lambda i: f"=MIN({BR['delivered_yr']},{ip.ref('usable', i)}*365*(1-{BR['aux_load']}))", NUM0, note="Seasonality-adjusted from the sizing sheet, capped by degraded capacity.")
ip.line("charged", "Energy drawn from the plant to charge (MWh)", lambda i: f"={ip.ref('delivered', i)}/{BR['rte']}", NUM0)
ip.line("peak_p", "Peak price this year (INR/kWh)", lambda i: f"={REF['noon_price']}+({REF['peak_price']}-{REF['noon_price']})*{ser('spread_idx', i)}", NUM2)
ip.line("noon_p", "Opportunity cost of charging energy (INR/kWh, net of curtailed share)", lambda i: f"={REF['noon_price']}*(1-{REF['curtail_share']})", NUM2)

ip.sec("Battery revenue (gross, before our fees)")
ip.line("rev_peak", "Sales into the evening peak (delivered MWh × peak price × 10)", lambda i: f"={ip.ref('delivered', i)}*{ip.ref('peak_p', i)}/100")
ip.line("cost_charge", "Less: midday value of the energy used to charge", lambda i: f"=-{ip.ref('charged', i)}*{ip.ref('noon_p', i)}/100")
ip.line("rev_grid", "Ancillary & capacity payments (via our aggregated bids)", lambda i: f"={ip.ref('mw', i)}*{REF['grid_per_mw']}*{ser('grid_active', i)}")
ip.line("rev_dsm", "Plant deviation charges avoided (battery + forecasting)", lambda i: f"={REF['plant_mw']}*{REF['dsm_rate']}*{ser('dsm_idx', i)}*{REF['dsm_recov']}")
ip.line("rev_gross", "GROSS BATTERY BENEFIT", lambda i: f"=SUM({ip.ref('rev_peak', i)}:{ip.ref('rev_dsm', i)})", bold=True)

ip.sec("Our fees")
ip.line("fee_fixed", "SaaS service fee (fixed, per battery MW)", lambda i: f"=-{ip.ref('mw', i)}*{REF['fee_per_mw']}*(1+{REF['cost_esc']})^{i}")
ip.line("fee_share", "Revenue share on arbitrage + grid services", lambda i: f"=-({ip.ref('rev_peak', i)}+{ip.ref('cost_charge', i)}+{ip.ref('rev_grid', i)})*{REF['share_arb']}")
ip.line("fee_dsm", "Share of deviation charges avoided", lambda i: f"=-{ip.ref('rev_dsm', i)}*{REF['share_dsm']}")
ip.line("fee_onb", "Onboarding fee (year 1)", lambda i: f"=-{REF['onboard_fee']}" if i == 0 else "=0")
ip.line("fee_total", "TOTAL FEES TO US", lambda i: f"=SUM({ip.ref('fee_fixed', i)}:{ip.ref('fee_onb', i)})", bold=True)

ip.sec("Battery operating costs")
ip.line("om", "O&M", lambda i: f"=-{BR['capex_plant']}*{REF['om_pct']}*(1+{REF['cost_esc']})^{i}")
ip.line("ins", "Insurance", lambda i: f"=-{BR['capex_plant']}*{REF['ins_pct_b']}")
ip.line("ebitda", "BATTERY EBITDA (after our fees)", lambda i: f"={ip.ref('rev_gross', i)}+{ip.ref('fee_total', i)}+{ip.ref('om', i)}+{ip.ref('ins', i)}", bold=True)

ip.sec("Loan (annual EMI, reducing balance)")
ip.line("loan", "Loan drawn (year 1)", lambda i: f"={BR['capex_plant']}*{REF['debt_pct']}" if i == 0 else "=0")
ip.line("emi", "EMI (annual)", lambda i: f"=IF({i+1}<={REF['debt_yrs']},-PMT({REF['debt_rate']},{REF['debt_yrs']},{YC[0]}{{loan}}),0)")
ip.line("open_bal", "Opening balance", lambda i: f"={YC[0]}{{loan}}" if i == 0 else f"={YC[i-1]}{{close_bal}}")
ip.line("interest", "Interest", lambda i: f"={ip.ref('open_bal', i)}*{REF['debt_rate']}")
ip.line("principal", "Principal repaid", lambda i: f"=MIN({ip.ref('open_bal', i)},{ip.ref('emi', i)}-{ip.ref('interest', i)})")
ip.line("close_bal", "Closing balance", lambda i: f"={ip.ref('open_bal', i)}-{ip.ref('principal', i)}")
ip.line("dscr", "Debt service coverage (EBITDA ÷ EMI)", lambda i: f"=IF({ip.ref('emi', i)}=0,0,{ip.ref('ebitda', i)}/{ip.ref('emi', i)})", fmt='0.00"x"', note="Lenders want ≥ 1.2x.")

ip.sec("Tax")
ip.line("wdv_open", "Tax written-down value, opening", lambda i: f"={BR['capex_plant']}" if i == 0 else f"={YC[i-1]}{{wdv_close}}+{YC[i-1]}{{aug}}*-1")
ip.line("tax_dep", "Tax depreciation (WDV)", lambda i: f"={ip.ref('wdv_open', i)}*{REF['wdv_rate']}")
ip.line("wdv_close", "Tax written-down value, closing", lambda i: f"={ip.ref('wdv_open', i)}-{ip.ref('tax_dep', i)}")
ip.line("pbt", "Taxable profit = EBITDA − interest − tax depreciation", lambda i: f"={ip.ref('ebitda', i)}-{ip.ref('interest', i)}-{ip.ref('tax_dep', i)}")
ip.line("loss_cf", "Losses carried forward (if shield not usable)", lambda i: f"=IF({REF['ipp_shield']}=1,0,MAX(0,-{ip.ref('pbt', i)}))" if i == 0 else f"=IF({REF['ipp_shield']}=1,0,MAX(0,{YC[i-1]}{{loss_cf}}-{ip.ref('pbt', i)}))")
ip.line("tax", "Tax (negative = shield used against other income)", lambda i: f"=IF({REF['ipp_shield']}=1,-{ip.ref('pbt', i)}*{REF['tax_rate']},-MAX(0,{ip.ref('pbt', i)}" + (f"-{YC[i-1]}{{loss_cf}}" if i > 0 else "") + f")*{REF['tax_rate']})")

ip.sec("Cash flow to the IPP's equity (post-tax)")
ip.line("equity_in", "Equity invested (year 1)", lambda i: f"=-{BR['capex_plant']}*(1-{REF['debt_pct']})" if i == 0 else "=0")
ip.line("aug", "Augmentation capex", lambda i: f"=IF({i+1}={REF['aug_year']},-{BR['capex_plant']}*{REF['aug_pct']},0)")
ip.line("salvage", "Salvage / continuing value (year 10)", lambda i: f"={BR['capex_plant']}*{REF['salvage_pct']}" if i == YEARS - 1 else "=0")
ip.line("cf_equity", "POST-TAX CASH FLOW TO EQUITY", lambda i: f"={ip.ref('ebitda', i)}-{ip.ref('emi', i)}+{ip.ref('tax', i)}+{ip.ref('equity_in', i)}+{ip.ref('aug', i)}+{ip.ref('salvage', i)}", bold=True)
ip.line("cf_cum", "Cumulative post-tax cash to equity", lambda i: f"={ip.ref('cf_equity', i)}" if i == 0 else f"={YC[i-1]}{{cf_cum}}+{ip.ref('cf_equity', i)}")

ip.sec("Without our SaaS (comparison: timer dispatch, no grid services, no deviation benefit, no fees)")
ip.line("w_ebitda", "Battery EBITDA without SaaS", lambda i: f"=({ip.ref('rev_peak', i)}+{ip.ref('cost_charge', i)})*{REF['passive_capture']}+{ip.ref('om', i)}+{ip.ref('ins', i)}")
ip.line("w_pbt", "Taxable profit without SaaS", lambda i: f"={ip.ref('w_ebitda', i)}-{ip.ref('interest', i)}-{ip.ref('tax_dep', i)}")
ip.line("w_tax", "Tax without SaaS", lambda i: f"=IF({REF['ipp_shield']}=1,-{ip.ref('w_pbt', i)}*{REF['tax_rate']},-MAX(0,{ip.ref('w_pbt', i)})*{REF['tax_rate']})")
ip.line("w_cf", "Post-tax cash flow to equity without SaaS", lambda i: f"={ip.ref('w_ebitda', i)}-{ip.ref('emi', i)}+{ip.ref('w_tax', i)}+{ip.ref('equity_in', i)}+{ip.ref('aug', i)}+{ip.ref('salvage', i)}", bold=True)
ip.line("benefit", "IPP'S POST-TAX BENEFIT FROM OUR SaaS (with − without)", lambda i: f"={ip.ref('cf_equity', i)}-{ip.ref('w_cf', i)}", bold=True)
ip.line("benefit_ratio", "Post-tax rupees the IPP keeps per rupee of fees", lambda i: f"=IF({ip.ref('fee_total', i)}=0,0,{ip.ref('benefit', i)}/-{ip.ref('fee_total', i)})", fmt='0.0"x"')

# resolve placeholders
ph = {"soh": ip.rows["soh"], "loan": ip.rows["loan"], "close_bal": ip.rows["close_bal"], "wdv_close": ip.rows["wdv_close"],
      "aug": ip.rows["aug"], "loss_cf": ip.rows["loss_cf"], "cf_cum": ip.rows["cf_cum"]}
for row in I.iter_rows(min_row=5, max_row=ip.row):
    for c in row:
        if isinstance(c.value, str) and "{" in c.value:
            v = c.value
            for k, rn in ph.items(): v = v.replace("{" + k + "}", str(rn))
            c.value = v
# returns block
rr_ = ip.row + 1
I.cell(row=rr_, column=1, value="IPP equity IRR, 10 years incl. salvage — WITH SaaS").font = BOLD
I.cell(row=rr_, column=3, value=f"=IFERROR(IRR(C{ip.rows['cf_equity']}:L{ip.rows['cf_equity']}),\"negative\")").number_format = PCT
I.cell(row=rr_ + 1, column=1, value="IPP equity IRR — WITHOUT SaaS").font = BOLD
I.cell(row=rr_ + 1, column=3, value=f"=IFERROR(IRR(C{ip.rows['w_cf']}:L{ip.rows['w_cf']}),\"negative\")").number_format = PCT
I.cell(row=rr_ + 2, column=1, value="NPV of equity cash flows at the discount rate — WITH SaaS").font = BOLD
I.cell(row=rr_ + 2, column=3, value=f"=NPV({REF['disc_rate']},D{ip.rows['cf_equity']}:L{ip.rows['cf_equity']})+C{ip.rows['cf_equity']}").number_format = NUM
I.cell(row=rr_ + 3, column=1, value="Simple equity payback year — WITH SaaS").font = BOLD
I.cell(row=rr_ + 3, column=3, value=f'=IFERROR(INDEX($C$4:$L$4,MATCH(TRUE,INDEX(C{ip.rows["cf_cum"]}:L{ip.rows["cf_cum"]}>0,0),0)),"beyond 10 yrs")')
I.cell(row=rr_ + 4, column=1, value="Minimum DSCR over loan life").font = BOLD
I.cell(row=rr_ + 4, column=3, value=f"=MIN(C{ip.rows['dscr']}:L{ip.rows['dscr']})").number_format = '0.00"x"'
IPP_IRR_CELL = f"'IPP Cash Flow'!$C${rr_}"; IPP_IRR_W_CELL = f"'IPP Cash Flow'!$C${rr_+1}"; IPP_NPV_CELL = f"'IPP Cash Flow'!$C${rr_+2}"
IPP_PAYBACK_CELL = f"'IPP Cash Flow'!$C${rr_+3}"; IPP_DSCR_CELL = f"'IPP Cash Flow'!$C${rr_+4}"
I.freeze_panes = "C5"

# ================================================================ Headcount
H = wb.create_sheet("Headcount")
style_sheet(H, {"A": 50, "B": 12, **{c: 10 for c in YC}})
H["A1"] = "Startup headcount — edit BLUE counts and Y1 salaries"; H["A1"].font = TITLE
header_row(H, 3, "Role (count)"); H["B3"] = "Y1 salary"; H["B3"].font = HDR; H["B3"].fill = HFILL
roles = [
    ("Head of power markets & dispatch (ex-exchange desk)", 45, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    ("Quant / data scientists (price & generation forecasting, optimisation)", 30, [2, 3, 4, 5, 6, 7, 8, 9, 10, 10]),
    ("Software engineers (dispatch engine, bidding, portal, BMS/PCS integration)", 22, [3, 5, 7, 9, 11, 13, 15, 17, 18, 18]),
    ("SCADA / controls / battery engineers (site integration, commissioning)", 15, [1, 2, 4, 6, 8, 10, 12, 13, 14, 14]),
    ("24x7 dispatch desk operators (5 per seat; 2 seats from Y4)", 9, [5, 5, 5, 10, 10, 10, 14, 14, 14, 14]),
    ("Regulatory & legal lead", 35, [0, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    ("Sales / business development (IPP promoters, CFOs)", 20, [2, 3, 4, 6, 8, 9, 10, 10, 10, 10]),
    ("Customer success / asset managers (1 per ~10 plants)", 12, [1, 1, 2, 3, 5, 7, 9, 11, 13, 14]),
    ("CFO", 50, [0, 0, 1, 1, 1, 1, 1, 1, 1, 1]),
    ("Finance & admin", 12, [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]),
    ("HR & operations", 10, [0, 1, 1, 2, 2, 3, 3, 3, 3, 3]),
    ("Field technicians (metering, telemetry, site visits)", 6, [1, 1, 2, 3, 4, 5, 6, 7, 8, 8]),
    ("Office assistants & drivers", 3.6, [1, 1, 2, 2, 3, 3, 4, 4, 4, 4]),
]
hr0 = 4
for j, (role, sal, counts) in enumerate(roles):
    row = hr0 + j
    H.cell(row=row, column=1, value=role).font = BLACK
    c = H.cell(row=row, column=2, value=sal); c.font = BLUE; c.number_format = NUM
    for i, n in enumerate(counts):
        c = H.cell(row=row, column=3 + i, value=n); c.font = BLUE; c.number_format = NUM0
hr_last = hr0 + len(roles) - 1
R_TOTAL_HC, R_FOUNDERS, R_ALL_HEADS, R_NEW_HIRES, R_SALES_HC, R_FIELD_HC = [hr_last + k for k in range(1, 7)]
for rw, lab in [(R_TOTAL_HC, "Total employees (ex-founders)"), (R_FOUNDERS, "Founders"), (R_ALL_HEADS, "Total heads incl. founders"),
                (R_NEW_HIRES, "New hires in year"), (R_SALES_HC, "Sales headcount (travel)"), (R_FIELD_HC, "Field + SCADA headcount (travel, cabs)")]:
    H.cell(row=rw, column=1, value=lab).font = BOLD if rw in (R_TOTAL_HC, R_ALL_HEADS) else BLACK
R_SALHDR = R_FIELD_HC + 2
header_row(H, R_SALHDR, "Salary cost (INR lakh)")
sal0 = R_SALHDR + 1
for j, (role, sal, counts) in enumerate(roles):
    row = sal0 + j
    H.cell(row=row, column=1, value=role).font = BLACK
    for i in range(YEARS):
        c = H.cell(row=row, column=3 + i, value=f"={YC[i]}{hr0 + j}*$B${hr0 + j}*(1+{REF['sal_esc']})^{i}"); c.number_format = NUM
R_SAL_TOTAL = sal0 + len(roles); R_NEWHIRE_SAL = R_SAL_TOTAL + 1
H.cell(row=R_SAL_TOTAL, column=1, value="Total salaries (ex-founders)").font = BOLD
H.cell(row=R_NEWHIRE_SAL, column=1, value="Annual salary of new hires (recruitment base)").font = BLACK
idx = {name: k for k, (name, _, _) in enumerate(roles)}
sales_rows = [hr0 + k for n, k in idx.items() if n.startswith("Sales")]
field_rows = [hr0 + k for n, k in idx.items() if n.startswith(("SCADA", "Field technicians"))]
for i in range(YEARS):
    col = YC[i]
    H[f"{col}{R_TOTAL_HC}"] = f"=SUM({col}{hr0}:{col}{hr_last})"
    H[f"{col}{R_FOUNDERS}"] = f"={REF['n_founders']}"; H[f"{col}{R_FOUNDERS}"].font = GREEN
    H[f"{col}{R_ALL_HEADS}"] = f"={col}{R_TOTAL_HC}+{col}{R_FOUNDERS}"
    H[f"{col}{R_NEW_HIRES}"] = f"={col}{R_TOTAL_HC}" if i == 0 else f"=MAX(0,{col}{R_TOTAL_HC}-{YC[i-1]}{R_TOTAL_HC})"
    H[f"{col}{R_NEWHIRE_SAL}"] = f"={col}{R_SAL_TOTAL}" if i == 0 else f"=IF({col}{R_TOTAL_HC}=0,0,{col}{R_NEW_HIRES}*{col}{R_SAL_TOTAL}/{col}{R_TOTAL_HC})"
    H[f"{col}{R_SALES_HC}"] = "=" + "+".join(f"{col}{rw}" for rw in sales_rows)
    H[f"{col}{R_FIELD_HC}"] = "=" + "+".join(f"{col}{rw}" for rw in field_rows)
    H[f"{col}{R_SAL_TOTAL}"] = f"=SUM({col}{sal0}:{col}{sal0 + len(roles) - 1})"
    for rw in (R_TOTAL_HC, R_FOUNDERS, R_ALL_HEADS, R_NEW_HIRES, R_SALES_HC, R_FIELD_HC): H[f"{col}{rw}"].number_format = NUM0
    for rw in (R_SAL_TOTAL, R_NEWHIRE_SAL): H[f"{col}{rw}"].number_format = NUM
    H[f"{col}{R_SAL_TOTAL}"].font = BOLD
def Hc(row, i): return f"Headcount!{YC[i]}{row}"

# ================================================================ Revenue (startup)
Rv = wb.create_sheet("Revenue")
style_sheet(Rv, {"A": 62, "B": 4, **{c: 12 for c in YC}})
Rv["A1"] = "Startup revenue (INR lakh) — built from the per-plant IPP sheet × number of plants"; Rv["A1"].font = TITLE
header_row(Rv, 3)
rv = Sheet(Rv, 4)
rv.sec("Fleet")
rv.line("plants", "Plants under management (year-end)", lambda i: f"={ser('plants', i)}", NUM0, font=GREEN)
rv.line("gross_new", "Gross new plants onboarded (net adds + churn replacement)", lambda i: f"={ser('plants', i)}" if i == 0 else f"=MAX(0,{ser('plants', i)}-{ser('plants', i-1)})+{REF['churn']}*{ser('plants', i-1)}")
rv.line("plant_mw", "Plant capacity under management (MW)", lambda i: f"={rv.ref('plants', i)}*{REF['plant_mw']}", NUM0)
rv.line("batt_mw", "Battery power under dispatch (MW)", lambda i: f"={rv.ref('plants', i)}*{BR['pcs_mw']}", NUM0)
rv.line("batt_mwh", "Battery energy under dispatch (MWh)", lambda i: f"={rv.ref('plants', i)}*{BR['nameplate']}", NUM0)
rv.line("mwh_delivered", "Energy shifted into the peak across the fleet (GWh)", lambda i: f"={rv.ref('plants', i)}*{ip.xref('delivered', i)}/1000", NUM0)
rv.sec("Revenue (per-plant fee lines × plants; a plant's fee profile is taken as its year-1 vintage value for simplicity)")
rv.line("r_fee", "1. Fixed SaaS service fee", lambda i: f"=-{ip.xref('fee_fixed', i)}*{rv.ref('plants', i)}")
rv.line("r_share", "2. Revenue share on arbitrage + grid services", lambda i: f"=-{ip.xref('fee_share', i)}*{rv.ref('plants', i)}")
rv.line("r_dsm", "3. Share of deviation charges avoided", lambda i: f"=-{ip.xref('fee_dsm', i)}*{rv.ref('plants', i)}")
rv.line("r_onb", "4. Onboarding fees", lambda i: f"={rv.ref('gross_new', i)}*{REF['onboard_fee']}")
rv.line("r_total", "TOTAL REVENUE", lambda i: f"=SUM({rv.ref('r_fee', i)}:{rv.ref('r_onb', i)})", bold=True)
rv.line("r_per_plant", "Revenue per plant", lambda i: f"=IF({rv.ref('plants', i)}=0,0,{rv.ref('r_total', i)}/{rv.ref('plants', i)})")
rv.line("r_new_rev", "Revenue from plants onboarded this year (commission base)", lambda i: f"=IF({rv.ref('plants', i)}=0,0,({rv.ref('r_total', i)}-{rv.ref('r_onb', i)})*{rv.ref('gross_new', i)}/{rv.ref('plants', i)})")
Rv.cell(row=rv.rows['r_fee'] - 1, column=1).comment = Comment("Simplification: every plant in year i is assumed to earn the fee profile of year i (prices and indices move with the market, not with the plant's age). Degradation/augmentation of older vintages is ignored at fleet level.", "model")

# ================================================================ Opex (startup)
O = wb.create_sheet("Opex")
style_sheet(O, {"A": 62, "B": 4, **{c: 12 for c in YC}})
O["A1"] = "Startup operating expenses (INR lakh)"; O["A1"].font = TITLE
header_row(O, 3)
op = Sheet(O, 4)
def esc(i): return f"(1+{REF['cost_esc']})^{i}"
op.sec("People")
op.line("salaries", "Salaries (ex-founders)", lambda i: f"={Hc(R_SAL_TOTAL, i)}")
op.line("founders", "Founder compensation", lambda i: f"={ser('founder_pay', i)}*{REF['n_founders']}")
op.line("statutory", "Employer statutory costs", lambda i: f"=({op.ref('salaries', i)}+{op.ref('founders', i)})*{REF['emp_cost']}")
op.line("commission", "Sales commissions", lambda i: f"={rv.xref('r_new_rev', i)}*{REF['commission']}")
op.line("recruit", "Recruitment", lambda i: f"={Hc(R_NEWHIRE_SAL, i)}*{REF['recruit_pct']}")
op.line("training", "Training & certifications", lambda i: f"={Hc(R_ALL_HEADS, i)}*{REF['training']}")
op.sec("Office & admin")
op.line("rent", "Office rent (Y1 co-working; leased office from Y2)", lambda i: f"={Hc(R_ALL_HEADS, i)}*{REF['cowork_seat']}*12" if i == 0 else f"={Hc(R_ALL_HEADS, i)}*{REF['sqft_head']}*{REF['rent_sqft']}*12/100000*(1+{REF['cost_esc']})^{i-1}")
op.line("cam", "Office maintenance / CAM", lambda i: "=0" if i == 0 else f"={op.ref('rent', i)}*{REF['cam_pct']}")
op.line("utilities", "Utilities & internet", lambda i: f"={Hc(R_ALL_HEADS, i)}*{REF['util_head']}*12*{esc(i)}")
op.line("consumables", "Consumables, pantry, courier, printing", lambda i: f"={Hc(R_ALL_HEADS, i)}*{REF['consum_head']}*12*{esc(i)}")
op.sec("Technology & site operations")
op.line("cloud", "Cloud & compute (forecasting, real-time dispatch loop)", lambda i: f"={REF['cloud_base']}+{REF['cloud_plant']}*{rv.xref('plants', i)}")
op.line("data", "Weather & market data subscriptions", lambda i: f"=({REF['data_base']}+{REF['data_plant']}*{rv.xref('plants', i)})*{esc(i)}")
op.line("software", "Software licences & cybersecurity", lambda i: f"={Hc(R_ALL_HEADS, i)}*{REF['sw_head']}*{esc(i)}")
op.line("telecom", "Site telemetry connectivity (redundant links)", lambda i: f"={rv.xref('plants', i)}*{REF['telecom_plant']}")
op.line("install", "Site commissioning (opex part)", lambda i: f"={rv.xref('gross_new', i)}*{REF['site_install']}*{esc(i)}")
op.sec("Regulatory, legal, insurance")
op.line("sldc", "SLDC/RLDC registration & scheduling fees", lambda i: f"={REF['sldc_fees']}*{esc(i)}")
op.line("legal", "Legal & regulatory", lambda i: f"={ser('legal', i)}")
op.line("audit", "Audit, accounting, CS, tax", lambda i: f"={ser('audit', i)}")
op.line("insurance", "Insurance (E&O, D&O, cyber, office)", lambda i: f"=MAX({REF['ins_min']}*{esc(i)},{rv.xref('r_total', i)}*{REF['ins_pct']})")
op.sec("Travel & vehicles")
op.line("travel", "Travel (flights, hotels, per diem)", lambda i: f"=({Hc(R_SALES_HC, i)}*{REF['trips_sales']}+{Hc(R_FIELD_HC, i)}*{REF['trips_field']}+{Hc(R_FOUNDERS, i)}*{REF['trips_mgmt']})*{REF['trip_cost']}*{esc(i)}")
op.line("fuel", "Owned vehicles — fuel", lambda i: f"={ser('vehicles', i)}*{REF['veh_fuel']}*{esc(i)}")
op.line("veh_ins", "Owned vehicles — insurance", lambda i: f"={ser('vehicles', i)}*{REF['veh_ins']}*{esc(i)}")
op.line("veh_maint", "Owned vehicles — repairs & maintenance", lambda i: f"={ser('vehicles', i)}*{REF['veh_maint']}*{esc(i)}")
op.line("cabs", "Cabs & rentals", lambda i: f"=(MAX(0,{Hc(R_FIELD_HC, i)}-2*{ser('vehicles', i)})*{REF['cab_field']}+{Hc(R_FOUNDERS, i)}*{REF['cab_exec']})*12*{esc(i)}")
op.sec("Commercial & other")
op.line("marketing", "Marketing, conferences, PR", lambda i: f"={ser('marketing', i)}")
op.line("pilots", "Free pilots & shadow trials", lambda i: f"={ser('pilots', i)}")
op.line("bank", "Bank charges", lambda i: f"={rv.xref('r_total', i)}*{REF['bank_pct']}")
op.line("baddebt", "Bad debts", lambda i: f"={rv.xref('r_total', i)}*{REF['baddebt_pct']}")
op.line("subtotal", "Subtotal before contingency", lambda i: f"=SUM({YC[i]}{op.rows['salaries']}:{YC[i]}{op.rows['baddebt']})")
op.line("contingency", "Contingency", lambda i: f"={op.ref('subtotal', i)}*{REF['contingency']}")
op.line("total", "TOTAL OPEX", lambda i: f"={op.ref('subtotal', i)}+{op.ref('contingency', i)}", bold=True)

# ================================================================ Capex & WC (startup)
C = wb.create_sheet("Capex & WC")
style_sheet(C, {"A": 62, "B": 4, **{c: 12 for c in YC}})
C["A1"] = "Startup capex, depreciation, deposits, working capital (INR lakh)"; C["A1"].font = TITLE
header_row(C, 3)
cx = Sheet(C, 4)
def wsum(row, i, life):
    s = max(0, i - life + 1); return f"SUM({YC[s]}{row}:{YC[i]}{row})"
cx.sec("Capex")
cx.line("cx_laptop", "Laptops (new hires + 3-year refresh)", lambda i: f"=({Hc(R_NEW_HIRES, i)}+{Hc(R_FOUNDERS, i) if i == 0 else '0'})*{REF['laptop']}" + (f"+{Hc(R_ALL_HEADS, i-3)}*{REF['laptop']}" if i >= 3 else ""))
cx.line("cx_furn", "Furniture & fit-out", lambda i: f"=({Hc(R_NEW_HIRES, i)}+{Hc(R_FOUNDERS, i) if i == 0 else '0'})*{REF['furniture']}")
cx.line("cx_veh", "Vehicles purchased", lambda i: f"={ser('vehicles', i)}*{REF['veh_cost']}" if i == 0 else f"=MAX(0,{ser('vehicles', i)}-{ser('vehicles', i-1)})*{REF['veh_cost']}")
cx.line("cx_site", "Site hardware at new plants (edge controller, RTU, gateways)", lambda i: f"={rv.xref('gross_new', i)}*{REF['site_hw']}")
cx.line("cx_total", "TOTAL CAPEX", lambda i: f"=SUM({YC[i]}{cx.rows['cx_laptop']}:{YC[i]}{cx.rows['cx_site']})", bold=True)
cx.sec("Depreciation (straight line: laptops 3 yrs, others 5 yrs)")
cx.line("d_laptop", "Laptops", lambda i: f"={wsum(cx.rows['cx_laptop'], i, 3)}/3")
cx.line("d_furn", "Furniture", lambda i: f"={wsum(cx.rows['cx_furn'], i, 5)}/5")
cx.line("d_veh", "Vehicles", lambda i: f"={wsum(cx.rows['cx_veh'], i, 5)}/5")
cx.line("d_site", "Site hardware", lambda i: f"={wsum(cx.rows['cx_site'], i, 5)}/5")
cx.line("d_total", "TOTAL DEPRECIATION", lambda i: f"=SUM({YC[i]}{cx.rows['d_laptop']}:{YC[i]}{cx.rows['d_site']})", bold=True)
cx.sec("Deposits & working capital")
cx.line("dep_rent", "Office rent deposit (balance)", lambda i: "=0" if i == 0 else f"={op.xref('rent', i)}/12*{REF['rent_deposit_m']}")
cx.line("dep_change", "Increase in deposits (cash outflow)", lambda i: f"={cx.ref('dep_rent', i)}" if i == 0 else f"={cx.ref('dep_rent', i)}-{YC[i-1]}{cx.rows['dep_rent']}")
cx.line("recv", "Receivables (balance)", lambda i: f"={rv.xref('r_total', i)}*{REF['recv_days']}/365")
cx.line("pay", "Payables (balance)", lambda i: f"={op.xref('total', i)}*{REF['pay_days']}/365")
cx.line("nwc", "Net working capital (balance)", lambda i: f"={cx.ref('recv', i)}-{cx.ref('pay', i)}")
cx.line("nwc_change", "Increase in net working capital (cash outflow)", lambda i: f"={cx.ref('nwc', i)}" if i == 0 else f"={cx.ref('nwc', i)}-{YC[i-1]}{cx.rows['nwc']}")

# ================================================================ Cash Flow (startup)
F = wb.create_sheet("Cash Flow")
style_sheet(F, {"A": 62, "B": 4, **{c: 12 for c in YC}})
F["A1"] = "Startup P&L and cash flow, post-tax (INR lakh)"; F["A1"].font = TITLE
header_row(F, 3)
cf = Sheet(F, 4)
cf.sec("Profit & loss")
cf.line("rev", "Revenue", lambda i: f"={rv.xref('r_total', i)}", bold=True)
cf.line("opex", "Operating expenses", lambda i: f"=-{op.xref('total', i)}")
cf.line("ebitda", "EBITDA", lambda i: f"={cf.ref('rev', i)}+{cf.ref('opex', i)}", bold=True)
cf.line("ebitda_m", "EBITDA margin", lambda i: f"=IF({cf.ref('rev', i)}=0,0,{cf.ref('ebitda', i)}/{cf.ref('rev', i)})", fmt=PCT)
cf.line("dep", "Depreciation", lambda i: f"=-{cx.xref('d_total', i)}")
cf.line("ebit", "EBIT", lambda i: f"={cf.ref('ebitda', i)}+{cf.ref('dep', i)}")
cf.line("interest", "Interest income on opening cash", lambda i: "=0" if i == 0 else f"=MAX(0,{YC[i-1]}{{close}})*{REF['int_rate']}")
cf.line("pbt", "Profit before tax", lambda i: f"={cf.ref('ebit', i)}+{cf.ref('interest', i)}")
cf.line("loss_cf", "Tax losses carried forward (closing)", lambda i: f"=MAX(0,-{cf.ref('pbt', i)})" if i == 0 else f"=MAX(0,{YC[i-1]}{{loss_cf}}-{cf.ref('pbt', i)})")
cf.line("tax", "Corporate tax", lambda i: f"=-MAX(0,{cf.ref('pbt', i)})*{REF['tax_rate']}" if i == 0 else f"=-MAX(0,{cf.ref('pbt', i)}-{YC[i-1]}{{loss_cf}})*{REF['tax_rate']}")
cf.line("pat", "Profit after tax", lambda i: f"={cf.ref('pbt', i)}+{cf.ref('tax', i)}", bold=True)
cf.sec("Cash flow")
cf.line("c_ebitda", "EBITDA", lambda i: f"={cf.ref('ebitda', i)}")
cf.line("c_tax", "Tax paid", lambda i: f"={cf.ref('tax', i)}")
cf.line("c_int", "Interest received", lambda i: f"={cf.ref('interest', i)}")
cf.line("c_nwc", "Increase in working capital", lambda i: f"=-{cx.xref('nwc_change', i)}")
cf.line("c_ocf", "Operating cash flow", lambda i: f"=SUM({YC[i]}{cf.rows['c_ebitda']}:{YC[i]}{cf.rows['c_nwc']})", bold=True)
cf.line("c_capex", "Capital expenditure", lambda i: f"=-{cx.xref('cx_total', i)}")
cf.line("c_dep", "Deposits", lambda i: f"=-{cx.xref('dep_change', i)}")
cf.line("c_fcf", "Free cash flow (before funding)", lambda i: f"={cf.ref('c_ocf', i)}+{cf.ref('c_capex', i)}+{cf.ref('c_dep', i)}", bold=True)
cf.line("c_eq", "Equity raised", lambda i: f"={ser('equity', i)}")
cf.line("open", "Opening cash", lambda i: "=0" if i == 0 else f"={YC[i-1]}{{close}}")
cf.line("close", "Closing cash", lambda i: f"={cf.ref('open', i)}+{cf.ref('c_fcf', i)}+{cf.ref('c_eq', i)}", bold=True)
cf.line("cum_fcf", "Cumulative free cash flow (before funding)", lambda i: f"={cf.ref('c_fcf', i)}" if i == 0 else f"={YC[i-1]}{{cum_fcf}}+{cf.ref('c_fcf', i)}")
cf.line("min_cash", "Lowest closing cash to date (must stay ≥ 0)", lambda i: f"={cf.ref('close', i)}" if i == 0 else f"=MIN({YC[i-1]}{{min_cash}},{cf.ref('close', i)})")
F.cell(row=cf.rows['min_cash'], column=1).fill = YFILL
ph = {"close": cf.rows["close"], "loss_cf": cf.rows["loss_cf"], "cum_fcf": cf.rows["cum_fcf"], "min_cash": cf.rows["min_cash"]}
for row in F.iter_rows(min_row=4, max_row=cf.row):
    for c in row:
        if isinstance(c.value, str) and "{" in c.value:
            v = c.value
            for k, rn in ph.items(): v = v.replace("{" + k + "}", str(rn))
            c.value = v

# ================================================================ Summary
S = wb.create_sheet("Summary", 0)
style_sheet(S, {"A": 62, "B": 4, **{c: 12 for c in YC}})
S["A1"] = "Battery-SaaS play — 10-year projection (INR lakh unless stated)"; S["A1"].font = TITLE
S["A2"] = "IPP buys battery on loan and pays EMI; we run it for a fixed fee + revenue share. Everything below recalculates from the Assumptions and Battery Sizing sheets."
S["A2"].font = Font(name="Arial", italic=True, size=10)
header_row(S, 4)
sm = Sheet(S, 5)
def L(f, fmt=NUM, bold=False): return (f, fmt, bold)
sm.sec("Fleet in MW")
sm.line("s_plants", "Plants under management (100 MW each)", lambda i: f"={rv.xref('plants', i)}", NUM0, font=GREEN)
sm.line("s_mw", "Plant MW under management", lambda i: f"={rv.xref('plant_mw', i)}", NUM0, font=GREEN)
sm.line("s_bmw", "Battery MW under dispatch", lambda i: f"={rv.xref('batt_mw', i)}", NUM0, font=GREEN)
sm.line("s_bmwh", "Battery MWh under dispatch", lambda i: f"={rv.xref('batt_mwh', i)}", NUM0, font=GREEN)
sm.line("s_gwh", "Energy shifted into the peak (GWh)", lambda i: f"={rv.xref('mwh_delivered', i)}", NUM0, font=GREEN)
sm.line("s_capex", "Battery capex financed by IPPs this year (INR crore)", lambda i: f"={rv.xref('gross_new', i)}*{BR['capex_plant']}/100", NUM, font=GREEN)
sm.sec("One IPP (per 100 MW plant), post-tax")
sm.line("s_igross", "Gross battery benefit", lambda i: f"={ip.xref('rev_gross', i)}", font=GREEN)
sm.line("s_ifees", "Fees paid to us", lambda i: f"={ip.xref('fee_total', i)}", font=GREEN)
sm.line("s_iemi", "EMI", lambda i: f"=-{ip.xref('emi', i)}", font=GREEN)
sm.line("s_itax", "Tax (negative = shield)", lambda i: f"={ip.xref('tax', i)}", font=GREEN)
sm.line("s_icf", "Post-tax cash to IPP equity (with SaaS)", lambda i: f"={ip.xref('cf_equity', i)}", bold=True)
sm.line("s_icf_w", "Post-tax cash to IPP equity (without SaaS)", lambda i: f"={ip.xref('w_cf', i)}", font=GREEN)
sm.line("s_iben", "IPP's post-tax benefit from our SaaS", lambda i: f"={ip.xref('benefit', i)}", bold=True)
sm.sec("Startup")
sm.line("s_rev", "Revenue", lambda i: f"={cf.xref('rev', i)}", bold=True)
sm.line("s_rpp", "Revenue per plant", lambda i: f"={rv.xref('r_per_plant', i)}", font=GREEN)
sm.line("s_heads", "Heads incl. founders", lambda i: f"={Hc(R_ALL_HEADS, i)}", NUM0, font=GREEN)
sm.line("s_opex", "Total opex", lambda i: f"=-{cf.xref('opex', i)}", font=GREEN)
sm.line("s_ebitda", "EBITDA", lambda i: f"={cf.xref('ebitda', i)}", bold=True)
sm.line("s_pat", "Profit after tax", lambda i: f"={cf.xref('pat', i)}", bold=True)
sm.line("s_fcf", "Free cash flow (before funding)", lambda i: f"={cf.xref('c_fcf', i)}", font=GREEN)
sm.line("s_eq", "Equity raised", lambda i: f"={cf.xref('c_eq', i)}", font=GREEN)
sm.line("s_cash", "Closing cash", lambda i: f"={cf.xref('close', i)}", bold=True)
k = sm.row + 1
kpis = [
    ("Battery per 100 MW plant: nameplate MWh / PCS MW", f"=TEXT({BR['nameplate']},\"0\")&\" MWh / \"&TEXT({BR['pcs_mw']},\"0\")&\" MW\"", None),
    ("Battery MWh per MW of plant (chosen target)", f"={BR['mwh_per_mw']}", NUM2),
    ("Battery MWh per MW of plant for a 'no-issue' firm promise", f"={BR['noissue_per_mw']}", NUM2),
    ("Firm-block availability at chosen target", f"={BR['availability']}", PCT),
    ("IPP equity IRR with SaaS (10 yrs, post-tax)", f"={IPP_IRR_CELL}", PCT),
    ("IPP equity IRR without SaaS", f"={IPP_IRR_W_CELL}", PCT),
    ("IPP equity NPV with SaaS (INR lakh)", f"={IPP_NPV_CELL}", NUM),
    ("IPP equity payback year with SaaS", f"={IPP_PAYBACK_CELL}", None),
    ("Minimum DSCR on the battery loan", f"={IPP_DSCR_CELL}", '0.00"x"'),
    ("Startup peak funding need (INR lakh)", f"=-MIN('Cash Flow'!C{cf.rows['cum_fcf']}:L{cf.rows['cum_fcf']})", NUM0),
    ("Startup first EBITDA-positive year", f'=IFERROR(INDEX($C$4:$L$4,MATCH(TRUE,INDEX(\'Cash Flow\'!C{cf.rows["ebitda"]}:L{cf.rows["ebitda"]}>0,0),0)),"none in 10 yrs")', None),
    ("Startup 10-year cumulative revenue (INR crore)", f"=SUM(Revenue!C{rv.rows['r_total']}:L{rv.rows['r_total']})/100", NUM),
    ("Startup 10-year cumulative PAT (INR crore)", f"=SUM('Cash Flow'!C{cf.rows['pat']}:L{cf.rows['pat']})/100", NUM),
]
for lab, f, fmt in kpis:
    S.cell(row=k, column=1, value=lab).font = BOLD
    c = S.cell(row=k, column=3, value=f)
    if fmt: c.number_format = fmt
    k += 1

# ================================================================ README
Rd = wb.create_sheet("README", 1)
style_sheet(Rd, {"A": 120})
lines = [
    ("How to use this model", TITLE),
    ("INR lakh (100 lakh = 1 crore). FY2027 (Y1) to FY2036 (Y10). BLUE cells on Assumptions, Battery Sizing and Headcount are inputs. BLACK = formulas, GREEN = links. Yellow = the levers that matter most.", BLACK),
    ("", BLACK),
    ("The play", BOLD),
    ("The IPP buys the battery at market price, funds it 75% with a 10-year loan and pays EMIs. We never own hardware. We supply the SaaS: generation and price forecasting, when to store versus sell, exchange bidding, real-time dispatch commands to the BMS/PCS, scheduling and deviation management. The IPP pays a fixed service fee per battery MW plus a share of the money the battery earns.", BLACK),
    ("", BLACK),
    ("Sheets", BOLD),
    ("Battery Sizing: how much battery a 100 MW plant needs to serve the evening peak, with seasonality (12 monthly factors), a P10 cloudy-day case, round-trip efficiency, depth of discharge, end-of-life capacity and a weather carry-over buffer. Reports MWh per MW of plant at the chosen target and at a 'no-issue' firm level.", BLACK),
    ("IPP Cash Flow: one plant's incremental battery project, post-tax, with EMI schedule, WDV tax depreciation, augmentation, salvage, IRR, NPV, DSCR, and the same project without our SaaS.", BLACK),
    ("Revenue / Headcount / Opex / Capex & WC / Cash Flow: the startup, with an itemised cost base (13 roles, founders at INR 4 lakh/month, rent, cloud, data, telemetry, travel, owned and rented vehicles with fuel/insurance/repairs, legal, audit, E&O insurance, marketing, pilots, bad debts, contingency, laptops, furniture, site hardware, deposits, working capital, tax with loss carry-forward).", BLACK),
    ("", BLACK),
    ("Sources and confidence", BOLD),
    ("Market inputs (peak and midday prices, spread compression, deviation charges and their tightening, battery capex, tender benchmarks, mandate timing) come from the research notes in /research_notes/Energy exchange startup opportunity/ and /reports/, gathered from search-result extracts on 14 Nov 2026. Seasonal factors are a typical north-west India solar profile, not a specific site. Cost items are the author's estimates of 2026 Indian market rates. Treat all of it as order-of-magnitude until replaced by an EPC quote, a lender term sheet, and a real plant's 15-minute data.", BLACK),
    ("", BLACK),
    ("Key untested assumptions", BOLD),
    ("1. Battery capex INR 0.9 crore/MWh turnkey. The IPP IRR swings ~8 points per INR 0.2 crore. 2. The evening/noon spread halves by FY33. 3. 30% of the plant's energy is shiftable (untied, merchant or curtailed). 4. Ancillary/capacity markets open to aggregated storage by FY31. 5. 40% WDV tax depreciation applies to BESS. 6. We avoid 30% of plant deviation charges.", BLACK),
    ("", BLACK),
    ("Simplifications", BOLD),
    ("Fleet revenue treats every plant as earning the current year's per-plant fee profile (no vintage tracking). Startup has no debt. GST pass-through. ESOPs not modelled. Annual, not monthly, EMI. No MAT. A plant counted in a year earns a full year.", BLACK),
]
for kk, (t, f) in enumerate(lines, start=1):
    c = Rd.cell(row=kk, column=1, value=t); c.font = f; c.alignment = Alignment(wrap_text=True, vertical="top")

for ws in (A, H, Rv, O, C, F, S): ws.freeze_panes = "C4"
wb._sheets = [wb["Summary"], wb["README"], wb["Battery Sizing"], wb["IPP Cash Flow"], wb["Assumptions"], wb["Headcount"], wb["Revenue"], wb["Opex"], wb["Capex & WC"], wb["Cash Flow"]]
out = "/home/user/Play/model/Battery_SaaS_10yr_model.xlsx"
wb.save(out); print("saved", out)
