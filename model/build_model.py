"""Build 10-year cash-flow model for the asset-light 'brain' business (plant owners own batteries).
All numbers in INR lakh unless stated. Years Y1..Y10 = FY2027..FY2036 in columns C..L."""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.comments import Comment

wb = Workbook()
YEARS = 10
YC = [get_column_letter(3 + i) for i in range(YEARS)]  # C..L
FY = [f"FY{2027 + i}" for i in range(YEARS)]

BLUE = Font(name="Arial", color="0000FF", size=10)
BLACK = Font(name="Arial", color="000000", size=10)
GREEN = Font(name="Arial", color="008000", size=10)
BOLD = Font(name="Arial", bold=True, size=10)
HDR = Font(name="Arial", bold=True, size=11, color="FFFFFF")
TITLE = Font(name="Arial", bold=True, size=14)
HFILL = PatternFill("solid", fgColor="1F3864")
SFILL = PatternFill("solid", fgColor="D9E1F2")
YFILL = PatternFill("solid", fgColor="FFFF00")
NUM = '#,##0.0;(#,##0.0);-'
NUM0 = '#,##0;(#,##0);-'
PCT = '0.0%'
thin = Side(style="thin", color="999999")

def style_sheet(ws, widths):
    for col, w in widths.items():
        ws.column_dimensions[col].width = w
    ws.sheet_view.showGridLines = False

def header_row(ws, row, label="INR lakh"):
    ws.cell(row=row, column=1, value=label).font = HDR
    ws.cell(row=row, column=1).fill = HFILL
    ws.cell(row=row, column=2, value="").fill = HFILL
    for i, fy in enumerate(FY):
        c = ws.cell(row=row, column=3 + i, value=fy)
        c.font = HDR; c.fill = HFILL; c.alignment = Alignment(horizontal="center")

def section(ws, row, text):
    ws.cell(row=row, column=1, value=text).font = BOLD
    for col in range(1, 3 + YEARS):
        ws.cell(row=row, column=col).fill = SFILL

# ---------------------------------------------------------------- Assumptions
A = wb.active
A.title = "Assumptions"
style_sheet(A, {"A": 58, "B": 14, **{c: 11 for c in YC}, "M": 60})
A["A1"] = "Assumptions — edit BLUE cells only. All money in INR lakh (100 lakh = 1 crore)."; A["A1"].font = TITLE
A["A2"] = "Business model: asset-light 'brain'. Plant owners own batteries; we provide forecasting, bidding, dispatch, exchange connectivity, scheduling and (from Y3) trading."
A["A2"].font = Font(name="Arial", italic=True, size=10)

REF = {}   # name -> absolute ref for scalars
SER = {}   # name -> row number for year series (use SER[name] with YC[i])
r = 4

def scalar(name, label, value, fmt=NUM, note=None):
    global r
    A.cell(row=r, column=1, value=label).font = BLACK
    c = A.cell(row=r, column=2, value=value); c.font = BLUE; c.number_format = fmt
    if note:
        A.cell(row=r, column=13, value=note).font = Font(name="Arial", italic=True, size=9, color="666666")
    REF[name] = f"Assumptions!$B${r}"
    r += 1

def series(name, label, values, fmt=NUM, note=None):
    global r
    A.cell(row=r, column=1, value=label).font = BLACK
    for i, v in enumerate(values):
        c = A.cell(row=r, column=3 + i, value=v); c.font = BLUE; c.number_format = fmt
    if note:
        A.cell(row=r, column=13, value=note).font = Font(name="Arial", italic=True, size=9, color="666666")
    SER[name] = r
    r += 1

def asec(text):
    global r
    section(A, r, text); r += 1

def ser(name, i):  # reference to series cell for year index i
    return f"Assumptions!${YC[i]}${SER[name]}"

header_row(A, 3, "Year series →")
asec("1. Market & customer ramp")
series("plants", "Plants under management, year-end (cumulative, net of churn)", [5, 15, 35, 65, 100, 140, 180, 220, 255, 285], NUM0,
       "Sales-led ramp against ~1,500 qualifying mid-size plants. Y5 = ~7% share.")
scalar("churn", "Annual churn (share of prior-year plants lost)", 0.05, PCT, "Replaced plants still incur onboarding cost and commission.")
scalar("avg_mw", "Average plant size (MW)", 70, NUM0)
scalar("wind_share", "Wind share of managed capacity", 0.30, PCT, "Rest is solar/hybrid. Wind carries ~2x deviation charges.")
scalar("cuf_solar", "Solar capacity utilisation factor", 0.20, PCT)
scalar("cuf_wind", "Wind capacity utilisation factor", 0.30, PCT)
series("battery_frac", "Share of managed plants with a co-located battery", [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.7, 0.7, 0.7, 0.7], PCT,
       "Rises with the proposed 10% co-location mandate from 2027.")
scalar("batt_mw_frac", "Battery MW as share of plant MW", 0.10, PCT, "CEA advisory: 10% of plant capacity.")
scalar("batt_hours", "Battery duration (hours)", 2, NUM0)
scalar("untied_frac", "Share of plants with untied/merchant capacity", 0.60, PCT)
scalar("untied_share", "Untied capacity as share of plant MW", 0.20, PCT)

asec("2. Pricing & market indices")
scalar("dsm_solar", "Deviation charges today, solar (INR lakh per MW per year)", 0.90, NUM, "Research: ~INR 0.8-1 crore per 100 MW solar per year (pre-2026 bands).")
scalar("dsm_wind", "Deviation charges today, wind (INR lakh per MW per year)", 2.00, NUM, "Research: ~INR 2 crore per 100 MW wind per year.")
series("dsm_idx", "Deviation-charge index (1.0 = FY26 level)", [1.0, 1.15, 1.3, 1.5, 1.7, 1.8, 1.9, 2.0, 2.0, 2.0], NUM,
       "Bands halved Apr 2026; X-factor to zero by Apr 2031 (FY31 = Y5). IWPA: +35-40% wind.")
scalar("dsm_recov", "Share of deviation charges we can avoid", 0.30, PCT, "Key untested assumption. Below 20% the product fails.")
scalar("dsm_share", "Our share of deviation charges avoided", 0.25, PCT)
scalar("uplift", "Exchange price uplift on untied power, FY27 (INR per kWh)", 0.50, '0.00', "Block-by-block DAM/RTM selling vs dumping at noon.")
series("spread_idx", "Spread/arbitrage compression index (1.0 = FY27)", [1.0, 0.9, 0.8, 0.7, 0.6, 0.55, 0.5, 0.5, 0.5, 0.5], NUM,
       "ERCOT/NEM/GB precedent; IEX expects a 3-5 year merchant window.")
series("untied_share_our", "Our share of untied-power upside", [0.40, 0.40, 0.35, 0.30, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25], PCT,
       "Contractual step-down to pre-empt renegotiation.")
scalar("arb_per_mwh", "Battery arbitrage pool, FY27 (INR lakh per MWh of storage per year)", 15.5, NUM,
       "INR 3.1 crore per 20 MWh: 300 cycles, 85% RTE, buy ~INR 2 / sell ~INR 8.5.")
scalar("batt_share", "Our share of battery arbitrage (owner owns battery)", 0.15, PCT, "UK/Texas optimiser norm 10-20%.")
series("grid_active", "Ancillary + capacity payments available to our batteries (1 = yes)", [0, 0, 0, 0, 1, 1, 1, 1, 1, 1], NUM0,
       "SRAS/TRAS open to aggregated storage and a capacity product assumed by FY31. Regulatory risk.")
scalar("grid_per_mw", "Ancillary + capacity revenue per battery MW per year (INR lakh)", 5.0, NUM, "Illustrative; GB/PJM equivalents range widely.")
scalar("grid_share", "Our share of ancillary/capacity revenue", 0.15, PCT)
scalar("onboard_fee", "One-time onboarding fee per plant (INR lakh)", 10, NUM, "Covers SCADA integration, metering interface, portal set-up.")
series("trading_active", "Trading licence active (Category V inter-state) (1 = yes)", [0, 0, 1, 1, 1, 1, 1, 1, 1, 1], NUM0, "INR 2 crore net worth required.")
scalar("trade_margin", "Trading margin on untied volume (INR per kWh)", 0.02, '0.000', "CERC caps trading margin at a few paise; verify current cap.")
scalar("include_cni", "SCENARIO SWITCH: include firm-green sales to industry (1 = yes, 0 = brain-only)", 1, NUM0,
       "The direct-marketer extension. Set 0 to see the pure intelligence business.")
A.cell(row=r - 1, column=2).fill = YFILL
series("cni_customers", "Firm-green industrial customers (cumulative)", [0, 0, 0, 0, 2, 5, 10, 16, 24, 32], NUM0, "Needs licence + supply book + battery dispatch track record first.")
scalar("cni_gwh", "Average industrial customer volume (GWh per year)", 30, NUM0, "~10-12 MW round-the-clock load.")
scalar("cni_margin", "Net margin on firm-green sales (INR per kWh)", 0.50, '0.00', "Sell ~INR 7 vs blended delivered cost ~INR 6-6.5.")

asec("3. People")
scalar("sal_esc", "Annual salary escalation", 0.08, PCT)
scalar("emp_cost", "Employer statutory costs (PF, gratuity, insurance) as % of salary", 0.15, PCT)
series("founder_pay", "Founder compensation, each (INR lakh per year)", [48, 52, 56, 60.5, 65.3, 70.5, 76.2, 82.3, 88.8, 96], NUM, "INR 4 lakh/month each from day 1 (user input), then +8%/yr. Edit freely.")
scalar("n_founders", "Number of founders", 2, NUM0)
scalar("commission", "Sales commission (% of first-year revenue from new plants)", 0.05, PCT)
scalar("recruit_pct", "Recruitment cost (% of annual salary of new hires)", 0.08, PCT)
scalar("training", "Training & certifications per head per year (INR lakh)", 0.30, NUM)

asec("4. Office & admin")
scalar("cowork_seat", "Y1 co-working seat cost (INR lakh per seat per month)", 0.12, NUM)
scalar("sqft_head", "Office space per head from Y2 (sq ft)", 80, NUM0)
scalar("rent_sqft", "Rent (INR per sq ft per month), Y2 price", 85, NUM0, "Bengaluru / Gurgaon grade-B.")
scalar("rent_deposit_m", "Rent security deposit (months of rent)", 10, NUM0)
scalar("cam_pct", "Maintenance / CAM as % of rent", 0.15, PCT)
scalar("util_head", "Utilities & internet per head per month (INR lakh)", 0.015, '0.000')
scalar("consum_head", "Consumables, pantry, courier, printing per head per month (INR lakh)", 0.025, '0.000')
scalar("cost_esc", "General cost escalation (rent, fees, travel)", 0.06, PCT)

asec("5. Technology & site")
scalar("cloud_base", "Cloud & compute base (INR lakh per year)", 15, NUM)
scalar("cloud_plant", "Cloud & compute per managed plant (INR lakh per year)", 1.5, NUM, "Forecast model training, 15-min data, bidding engine.")
scalar("data_base", "Weather & market data subscriptions base (INR lakh per year)", 25, NUM, "Satellite irradiance, NWP, IEX data feeds.")
scalar("data_plant", "Data subscriptions per plant (INR lakh per year)", 0.5, NUM)
scalar("sw_head", "Software licences & cybersecurity per head per year (INR lakh)", 0.6, NUM)
scalar("telecom_plant", "Site telemetry connectivity per plant per year (INR lakh)", 1.2, NUM, "4G/VSAT, RTU SIMs, VPN.")
scalar("site_hw", "Site hardware per new plant — capex (INR lakh)", 4.0, NUM, "RTU/gateway, meter interface, cabinet.")
scalar("site_install", "Site installation & commissioning per new plant — opex (INR lakh)", 1.0, NUM)
scalar("laptop", "Laptop & peripherals per new head — capex (INR lakh)", 1.0, NUM)
scalar("laptop_life", "Laptop refresh / depreciation life (years)", 3, NUM0)
scalar("furniture", "Furniture & fit-out per new head — capex (INR lakh)", 0.4, NUM)
scalar("furn_life", "Furniture depreciation life (years)", 5, NUM0)
scalar("site_hw_life", "Site hardware depreciation life (years)", 5, NUM0)

asec("6. Vehicles & travel")
series("vehicles", "Owned field vehicles (cumulative)", [0, 2, 3, 4, 5, 6, 6, 6, 6, 6], NUM0, "Set all to 0 to run rental-only.")
scalar("veh_cost", "Vehicle purchase cost (INR lakh)", 12, NUM)
scalar("veh_life", "Vehicle depreciation life (years)", 5, NUM0)
scalar("veh_fuel", "Fuel per vehicle per year (INR lakh)", 1.5, NUM, "~25,000 km at INR 6/km.")
scalar("veh_ins", "Insurance per vehicle per year (INR lakh)", 0.4, NUM)
scalar("veh_maint", "Repairs & maintenance per vehicle per year (INR lakh)", 0.6, NUM)
scalar("cab_field", "Cab/rental spend per field engineer per month (INR lakh)", 0.25, NUM, "Applies to field engineers not covered by owned vehicles (2 per vehicle).")
scalar("cab_exec", "Cab spend per founder/executive per month (INR lakh)", 0.10, NUM)
scalar("trip_cost", "Cost per domestic site/sales trip (INR lakh)", 0.19, NUM, "Flight 8,000 + 2 nights 8,000 + per diem 3,000.")
scalar("trips_sales", "Trips per salesperson per year", 48, NUM0)
scalar("trips_field", "Trips per field/SCADA engineer per year", 72, NUM0)
scalar("trips_mgmt", "Trips per founder/executive per year", 24, NUM0)

asec("7. Regulatory, legal, insurance, marketing")
scalar("lic_app", "Trading licence application & set-up (one-time, INR lakh)", 10, NUM)
scalar("lic_annual", "Trading licence annual fee (INR lakh)", 5, NUM)
scalar("exch_deposit", "Exchange membership deposit (refundable, INR lakh)", 50, NUM)
scalar("exch_annual", "Exchange membership annual fee (INR lakh)", 10, NUM)
scalar("sldc_fees", "SLDC/RLDC registration & scheduling fees (INR lakh per year)", 5, NUM)
scalar("margin_pct", "Payment-security margin held at exchange (% of annual traded value)", 0.01, PCT, "~3-4 trading days of exposure. Cash tied up, not an expense.")
series("legal", "Legal & regulatory (law firm, filings, petitions) (INR lakh)", [30, 40, 60, 70, 80, 80, 80, 80, 80, 80], NUM)
series("audit", "Audit, accounting, company secretary, tax (INR lakh)", [8, 10, 15, 20, 25, 30, 30, 30, 30, 30], NUM)
scalar("ins_pct", "Insurance (professional indemnity, D&O, cyber, office) as % of revenue", 0.005, PCT, "We tell owners when to bid; E&O cover matters.")
scalar("ins_min", "Insurance minimum (INR lakh per year)", 15, NUM)
series("marketing", "Marketing, conferences, PR (INR lakh)", [15, 20, 30, 40, 50, 60, 60, 60, 60, 60], NUM)
series("pilots", "Free pilots & shadow trials (INR lakh)", [20, 20, 10, 0, 0, 0, 0, 0, 0, 0], NUM)
scalar("bank_pct", "Bank charges & payment processing (% of revenue)", 0.002, PCT)
scalar("baddebt_pct", "Bad debts (% of revenue)", 0.02, PCT)
scalar("contingency", "Contingency (% of total opex)", 0.05, PCT)

asec("8. Finance")
scalar("recv_days", "Receivable days", 60, NUM0)
scalar("pay_days", "Payable days (on opex)", 30, NUM0)
scalar("tax_rate", "Corporate tax rate", 0.2517, PCT, "25% + surcharge & cess (new regime).")
scalar("int_rate", "Interest income on cash balance", 0.06, PCT)
series("equity", "Equity raised (INR lakh)", [1200, 0, 2500, 0, 0, 0, 0, 0, 0, 0], NUM0, "Seed INR 12 crore Y1, Series A INR 25 crore Y3. Adjust to the funding gap shown in Cash Flow.")

# ---------------------------------------------------------------- Headcount
H = wb.create_sheet("Headcount")
style_sheet(H, {"A": 44, "B": 14, **{c: 11 for c in YC}})
H["A1"] = "Headcount plan — edit BLUE counts and Y1 salaries"; H["A1"].font = TITLE
header_row(H, 3, "Role (count)")
H["B3"] = "Y1 salary"; H["B3"].font = HDR; H["B3"].fill = HFILL
roles = [
    ("Head of trading / power markets (ex-exchange desk)", 45, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    ("Quant / data scientists (forecasting, optimisation)", 30, [2, 3, 4, 5, 6, 7, 8, 9, 10, 10]),
    ("Power traders (licensed desk, from Y3)", 35, [0, 0, 2, 3, 4, 5, 6, 6, 6, 6]),
    ("Industrial sales & contract structuring (firm-green)", 25, [0, 0, 0, 1, 2, 4, 6, 8, 8, 8]),
    ("Software engineers (platform, bidding engine, portal)", 22, [3, 5, 7, 9, 11, 13, 15, 17, 18, 18]),
    ("SCADA / controls engineers (site integration)", 15, [1, 2, 3, 5, 6, 8, 9, 10, 10, 10]),
    ("Scheduling desk analysts (24x7 shifts)", 9, [4, 5, 5, 8, 10, 10, 14, 14, 14, 14]),
    ("Regulatory & legal lead", 35, [0, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    ("Sales / business development", 20, [2, 3, 4, 6, 8, 9, 10, 10, 10, 10]),
    ("Customer success / account managers (1 per ~15 plants)", 12, [1, 1, 2, 4, 7, 9, 12, 15, 17, 19]),
    ("CFO", 50, [0, 0, 1, 1, 1, 1, 1, 1, 1, 1]),
    ("Finance & admin", 12, [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]),
    ("HR & operations", 10, [0, 1, 1, 2, 2, 3, 3, 3, 3, 3]),
    ("Field technicians (metering, site visits)", 6, [1, 1, 2, 3, 4, 5, 6, 7, 8, 8]),
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
R_TOTAL_HC = hr_last + 1
H.cell(row=R_TOTAL_HC, column=1, value="Total employees (ex-founders)").font = BOLD
R_FOUNDERS = R_TOTAL_HC + 1
H.cell(row=R_FOUNDERS, column=1, value="Founders").font = BLACK
R_ALL_HEADS = R_FOUNDERS + 1
H.cell(row=R_ALL_HEADS, column=1, value="Total heads incl. founders").font = BOLD
R_NEW_HIRES = R_ALL_HEADS + 1
H.cell(row=R_NEW_HIRES, column=1, value="New hires in year (ex-founders)").font = BLACK
R_SALES_HC = R_NEW_HIRES + 1
H.cell(row=R_SALES_HC, column=1, value="Sales headcount (for travel)").font = BLACK
R_FIELD_HC = R_SALES_HC + 1
H.cell(row=R_FIELD_HC, column=1, value="Field + SCADA headcount (for travel/cabs)").font = BLACK

# salary cost block
R_SALHDR = R_FIELD_HC + 2
header_row(H, R_SALHDR, "Salary cost (INR lakh)")
sal0 = R_SALHDR + 1
for j, (role, sal, counts) in enumerate(roles):
    row = sal0 + j
    H.cell(row=row, column=1, value=role).font = BLACK
    for i in range(YEARS):
        f = f"={YC[i]}{hr0 + j}*$B${hr0 + j}*(1+{REF['sal_esc']})^{i}"
        c = H.cell(row=row, column=3 + i, value=f); c.font = BLACK; c.number_format = NUM
R_SAL_TOTAL = sal0 + len(roles)
H.cell(row=R_SAL_TOTAL, column=1, value="Total salaries (ex-founders)").font = BOLD
R_NEWHIRE_SAL = R_SAL_TOTAL + 1
H.cell(row=R_NEWHIRE_SAL, column=1, value="Annual salary of new hires (for recruitment cost)").font = BLACK
for i in range(YEARS):
    col = YC[i]
    H[f"{col}{R_TOTAL_HC}"] = f"=SUM({col}{hr0}:{col}{hr_last})"
    H[f"{col}{R_FOUNDERS}"] = f"={REF['n_founders']}"; H[f"{col}{R_FOUNDERS}"].font = GREEN
    H[f"{col}{R_ALL_HEADS}"] = f"={col}{R_TOTAL_HC}+{col}{R_FOUNDERS}"
    if i == 0:
        H[f"{col}{R_NEW_HIRES}"] = f"={col}{R_TOTAL_HC}"
        H[f"{col}{R_NEWHIRE_SAL}"] = f"={col}{R_SAL_TOTAL}"
    else:
        prev = YC[i - 1]
        H[f"{col}{R_NEW_HIRES}"] = f"=MAX(0,{col}{R_TOTAL_HC}-{prev}{R_TOTAL_HC})"
        # new-hire salary ≈ new hires × average salary this year
        H[f"{col}{R_NEWHIRE_SAL}"] = f"=IF({col}{R_TOTAL_HC}=0,0,{col}{R_NEW_HIRES}*{col}{R_SAL_TOTAL}/{col}{R_TOTAL_HC})"
    idx = {name: k for k, (name, _, _) in enumerate(roles)}
    sales_rows = [hr0 + k for name, k in idx.items() if name.startswith("Sales /") or name.startswith("Industrial sales")]
    field_rows = [hr0 + k for name, k in idx.items() if name.startswith("SCADA") or name.startswith("Field technicians")]
    H[f"{col}{R_SALES_HC}"] = "=" + "+".join(f"{col}{rw}" for rw in sales_rows)
    H[f"{col}{R_FIELD_HC}"] = "=" + "+".join(f"{col}{rw}" for rw in field_rows)
    H[f"{col}{R_SAL_TOTAL}"] = f"=SUM({col}{sal0}:{col}{sal0 + len(roles) - 1})"
    for rr in (R_TOTAL_HC, R_FOUNDERS, R_ALL_HEADS, R_NEW_HIRES, R_SALES_HC, R_FIELD_HC):
        H[f"{col}{rr}"].number_format = NUM0
    for rr in (R_SAL_TOTAL, R_NEWHIRE_SAL):
        H[f"{col}{rr}"].number_format = NUM; H[f"{col}{rr}"].font = BOLD if rr == R_SAL_TOTAL else BLACK

def Hc(row, i): return f"Headcount!{YC[i]}{row}"

# ---------------------------------------------------------------- Revenue
Rv = wb.create_sheet("Revenue")
style_sheet(Rv, {"A": 58, "B": 4, **{c: 12 for c in YC}})
Rv["A1"] = "Customers & revenue (INR lakh)"; Rv["A1"].font = TITLE
header_row(Rv, 3)
rows_rev = {}
rr = 4
def rv_line(key, label, fmla_fn, fmt=NUM, bold=False, font=BLACK):
    global rr
    rows_rev[key] = rr
    Rv.cell(row=rr, column=1, value=label).font = BOLD if bold else BLACK
    for i in range(YEARS):
        c = Rv.cell(row=rr, column=3 + i, value=fmla_fn(i)); c.number_format = fmt
        c.font = BOLD if bold else font
    rows_rev[key] = rr
    rr += 1
def rv_sec(text):
    global rr
    section(Rv, rr, text); rr += 1

rv_sec("Customer base")
rv_line("plants", "Plants under management (year-end)", lambda i: f"={ser('plants', i)}", NUM0, font=GREEN)
rv_line("gross_new", "Gross new plants onboarded (net adds + churn replacement)",
        lambda i: f"={ser('plants', i)}" if i == 0 else f"=MAX(0,{ser('plants', i)}-{ser('plants', i-1)})+{REF['churn']}*{ser('plants', i-1)}", NUM)
rv_line("mw", "Capacity under management (MW)", lambda i: f"={YC[i]}{rows_rev['plants']}*{REF['avg_mw']}", NUM0)
rv_line("batt_mwh", "Battery storage dispatched by us (MWh)",
        lambda i: f"={YC[i]}{rows_rev['plants']}*{ser('battery_frac', i)}*{REF['avg_mw']}*{REF['batt_mw_frac']}*{REF['batt_hours']}", NUM0)
rv_line("batt_mw", "Battery power dispatched by us (MW)",
        lambda i: f"={YC[i]}{rows_rev['batt_mwh']}/{REF['batt_hours']}", NUM0)
rv_line("untied_gwh", "Untied energy we sell (GWh)",
        lambda i: f"={YC[i]}{rows_rev['plants']}*{REF['untied_frac']}*{REF['avg_mw']}*{REF['untied_share']}*({REF['wind_share']}*{REF['cuf_wind']}+(1-{REF['wind_share']})*{REF['cuf_solar']})*8760/1000", NUM0)
rv_line("cni_gwh", "Firm-green energy sold to industry (GWh)",
        lambda i: f"={ser('cni_customers', i)}*{REF['cni_gwh']}*{REF['include_cni']}", NUM0)

rv_sec("Value pools (what the customer gains, before our cut)")
rv_line("dsm_pool", "Deviation charges on managed fleet",
        lambda i: f"={YC[i]}{rows_rev['mw']}*({REF['wind_share']}*{REF['dsm_wind']}+(1-{REF['wind_share']})*{REF['dsm_solar']})*{ser('dsm_idx', i)}")
rv_line("dsm_saved", "Deviation charges avoided", lambda i: f"={YC[i]}{rows_rev['dsm_pool']}*{REF['dsm_recov']}")
rv_line("uplift_pool", "Exchange uplift on untied power (GWh × INR/kWh × 10)",
        lambda i: f"={YC[i]}{rows_rev['untied_gwh']}*10*{REF['uplift']}*{ser('spread_idx', i)}")
rv_line("arb_pool", "Battery arbitrage earned by owners",
        lambda i: f"={YC[i]}{rows_rev['batt_mwh']}*{REF['arb_per_mwh']}*{ser('spread_idx', i)}")
rv_line("grid_pool", "Ancillary + capacity payments to owners' batteries",
        lambda i: f"={YC[i]}{rows_rev['batt_mw']}*{REF['grid_per_mw']}*{ser('grid_active', i)}")

rv_sec("Our revenue")
rv_line("r_dsm", "1. Deviation reduction (share of charges avoided)", lambda i: f"={YC[i]}{rows_rev['dsm_saved']}*{REF['dsm_share']}")
rv_line("r_uplift", "2. Untied-power optimisation (share of upside)", lambda i: f"={YC[i]}{rows_rev['uplift_pool']}*{ser('untied_share_our', i)}")
rv_line("r_batt", "3. Battery dispatch intelligence (share of arbitrage)", lambda i: f"={YC[i]}{rows_rev['arb_pool']}*{REF['batt_share']}")
rv_line("r_grid", "4. Ancillary & capacity (share, from market opening)", lambda i: f"={YC[i]}{rows_rev['grid_pool']}*{REF['grid_share']}")
rv_line("r_trade", "5. Trading margin on untied volume (licence from Y3)",
        lambda i: f"={YC[i]}{rows_rev['untied_gwh']}*10*{REF['trade_margin']}*{ser('trading_active', i)}")
rv_line("r_onboard", "6. Onboarding fees (one-time per new plant)", lambda i: f"={YC[i]}{rows_rev['gross_new']}*{REF['onboard_fee']}")
rv_line("r_cni", "7. Firm-green sales to industry (scenario switch)", lambda i: f"={YC[i]}{rows_rev['cni_gwh']}*10*{REF['cni_margin']}")
rv_line("r_total", "TOTAL REVENUE", lambda i: f"=SUM({YC[i]}{rows_rev['r_dsm']}:{YC[i]}{rows_rev['r_cni']})", bold=True)
rv_line("r_brain", "  of which core intelligence business (lines 1-6)", lambda i: f"={YC[i]}{rows_rev['r_total']}-{YC[i]}{rows_rev['r_cni']}")
rv_line("r_new_plant_rev", "Revenue from plants onboarded this year (for commissions)",
        lambda i: f"=IF({YC[i]}{rows_rev['plants']}=0,0,({YC[i]}{rows_rev['r_total']}-{YC[i]}{rows_rev['r_cni']}-{YC[i]}{rows_rev['r_onboard']})*{YC[i]}{rows_rev['gross_new']}/{YC[i]}{rows_rev['plants']})")
rv_line("r_per_plant", "Core revenue per managed plant", lambda i: f"=IF({YC[i]}{rows_rev['plants']}=0,0,{YC[i]}{rows_rev['r_brain']}/{YC[i]}{rows_rev['plants']})")
rv_line("traded_value", "Annual traded value through our licence (for margin money)",
        lambda i: f"={YC[i]}{rows_rev['untied_gwh']}*10*3.5*{ser('trading_active', i)}+{YC[i]}{rows_rev['cni_gwh']}*10*7")
Rv.cell(row=rows_rev['traded_value'], column=1).comment = Comment("Untied power valued at ~INR 3.5/kWh and industrial sales at ~INR 7/kWh. Used only to size exchange margin money.", "model")

def Rc(key, i): return f"Revenue!{YC[i]}{rows_rev[key]}"

# ---------------------------------------------------------------- Opex
O = wb.create_sheet("Opex")
style_sheet(O, {"A": 58, "B": 4, **{c: 12 for c in YC}})
O["A1"] = "Operating expenses (INR lakh)"; O["A1"].font = TITLE
header_row(O, 3)
rows_op = {}
orow = 4
def op_line(key, label, fmla_fn, bold=False):
    global orow
    rows_op[key] = orow
    O.cell(row=orow, column=1, value=label).font = BOLD if bold else BLACK
    for i in range(YEARS):
        c = O.cell(row=orow, column=3 + i, value=fmla_fn(i)); c.number_format = NUM; c.font = BOLD if bold else BLACK
    rows_op[key] = orow
    orow += 1
def op_sec(text):
    global orow
    section(O, orow, text); orow += 1
def esc(i): return f"(1+{REF['cost_esc']})^{i}"

op_sec("People")
op_line("salaries", "Salaries (ex-founders)", lambda i: f"={Hc(R_SAL_TOTAL, i)}")
op_line("founders", "Founder compensation", lambda i: f"={ser('founder_pay', i)}*{REF['n_founders']}")
op_line("statutory", "Employer statutory costs (PF, gratuity, insurance)", lambda i: f"=({YC[i]}{rows_op['salaries']}+{YC[i]}{rows_op['founders']})*{REF['emp_cost']}")
op_line("commission", "Sales commissions", lambda i: f"={Rc('r_new_plant_rev', i)}*{REF['commission']}")
op_line("recruit", "Recruitment (agency fees, job boards)", lambda i: f"={Hc(R_NEWHIRE_SAL, i)}*{REF['recruit_pct']}")
op_line("training", "Training & certifications", lambda i: f"={Hc(R_ALL_HEADS, i)}*{REF['training']}")

op_sec("Office & admin")
op_line("rent", "Office rent (Y1 co-working; leased office from Y2)",
        lambda i: f"={Hc(R_ALL_HEADS, i)}*{REF['cowork_seat']}*12" if i == 0 else
        f"={Hc(R_ALL_HEADS, i)}*{REF['sqft_head']}*{REF['rent_sqft']}*12/100000*(1+{REF['cost_esc']})^{i-1}")
op_line("cam", "Office maintenance / CAM", lambda i: "=0" if i == 0 else f"={YC[i]}{rows_op['rent']}*{REF['cam_pct']}")
op_line("utilities", "Utilities & internet", lambda i: f"={Hc(R_ALL_HEADS, i)}*{REF['util_head']}*12*{esc(i)}")
op_line("consumables", "Office consumables, pantry, courier, printing", lambda i: f"={Hc(R_ALL_HEADS, i)}*{REF['consum_head']}*12*{esc(i)}")

op_sec("Technology & site operations")
op_line("cloud", "Cloud & compute", lambda i: f"=({REF['cloud_base']}+{REF['cloud_plant']}*{Rc('plants', i)})")
op_line("data", "Weather & market data subscriptions", lambda i: f"=({REF['data_base']}+{REF['data_plant']}*{Rc('plants', i)})*{esc(i)}")
op_line("software", "Software licences & cybersecurity", lambda i: f"={Hc(R_ALL_HEADS, i)}*{REF['sw_head']}*{esc(i)}")
op_line("telecom", "Site telemetry connectivity", lambda i: f"={Rc('plants', i)}*{REF['telecom_plant']}")
op_line("install", "Site installation & commissioning (opex part)", lambda i: f"={Rc('gross_new', i)}*{REF['site_install']}*{esc(i)}")

op_sec("Regulatory, legal, insurance")
op_line("licence", "Trading licence, exchange & SLDC fees",
        lambda i: f"={ser('trading_active', i)}*({REF['lic_annual']}+{REF['exch_annual']}+{REF['sldc_fees']})*{esc(i)}"
        + (f"+IF(AND({ser('trading_active', i)}=1,{ser('trading_active', i-1)}=0),{REF['lic_app']},0)" if i > 0 else f"+{ser('trading_active', i)}*{REF['lic_app']}"))
op_line("legal", "Legal & regulatory", lambda i: f"={ser('legal', i)}")
op_line("audit", "Audit, accounting, company secretary, tax filings", lambda i: f"={ser('audit', i)}")
op_line("insurance", "Insurance (E&O, D&O, cyber, office)", lambda i: f"=MAX({REF['ins_min']}*{esc(i)},{Rc('r_total', i)}*{REF['ins_pct']})")

op_sec("Travel & vehicles")
op_line("travel", "Travel (flights, hotels, per diem)",
        lambda i: f"=({Hc(R_SALES_HC, i)}*{REF['trips_sales']}+{Hc(R_FIELD_HC, i)}*{REF['trips_field']}+{Hc(R_FOUNDERS, i)}*{REF['trips_mgmt']})*{REF['trip_cost']}*{esc(i)}")
op_line("fuel", "Owned vehicles — fuel", lambda i: f"={ser('vehicles', i)}*{REF['veh_fuel']}*{esc(i)}")
op_line("veh_ins", "Owned vehicles — insurance", lambda i: f"={ser('vehicles', i)}*{REF['veh_ins']}*{esc(i)}")
op_line("veh_maint", "Owned vehicles — repairs & maintenance", lambda i: f"={ser('vehicles', i)}*{REF['veh_maint']}*{esc(i)}")
op_line("cabs", "Cabs & rentals (field staff beyond owned vehicles, executives)",
        lambda i: f"=(MAX(0,{Hc(R_FIELD_HC, i)}-2*{ser('vehicles', i)})*{REF['cab_field']}+{Hc(R_FOUNDERS, i)}*{REF['cab_exec']})*12*{esc(i)}")

op_sec("Commercial & other")
op_line("marketing", "Marketing, conferences, PR", lambda i: f"={ser('marketing', i)}")
op_line("pilots", "Free pilots & shadow trials", lambda i: f"={ser('pilots', i)}")
op_line("bank", "Bank charges & payment processing", lambda i: f"={Rc('r_total', i)}*{REF['bank_pct']}")
op_line("baddebt", "Bad debts", lambda i: f"={Rc('r_total', i)}*{REF['baddebt_pct']}")
first_op = rows_op['salaries']; last_op = rows_op['baddebt']
op_line("subtotal", "Subtotal before contingency", lambda i: f"=SUM({YC[i]}{first_op}:{YC[i]}{last_op})-SUMIF($A${first_op}:$A${last_op},\"\",{YC[i]}{first_op}:{YC[i]}{last_op})")
op_line("contingency", "Contingency", lambda i: f"={YC[i]}{rows_op['subtotal']}*{REF['contingency']}")
op_line("total", "TOTAL OPEX", lambda i: f"={YC[i]}{rows_op['subtotal']}+{YC[i]}{rows_op['contingency']}", bold=True)
# subtotal: section header rows have no values, so plain SUM works; simplify
for i in range(YEARS):
    O[f"{YC[i]}{rows_op['subtotal']}"] = f"=SUM({YC[i]}{first_op}:{YC[i]}{last_op})"
def Oc(key, i): return f"Opex!{YC[i]}{rows_op[key]}"

# ---------------------------------------------------------------- Capex & WC
C = wb.create_sheet("Capex & WC")
style_sheet(C, {"A": 58, "B": 4, **{c: 12 for c in YC}})
C["A1"] = "Capital expenditure, depreciation, deposits and working capital (INR lakh)"; C["A1"].font = TITLE
header_row(C, 3)
rows_cx = {}
crow = 4
def cx_line(key, label, fmla_fn, bold=False):
    global crow
    rows_cx[key] = crow
    C.cell(row=crow, column=1, value=label).font = BOLD if bold else BLACK
    for i in range(YEARS):
        c = C.cell(row=crow, column=3 + i, value=fmla_fn(i)); c.number_format = NUM; c.font = BOLD if bold else BLACK
    rows_cx[key] = crow
    crow += 1
def cx_sec(text):
    global crow
    section(C, crow, text); crow += 1
def window_sum(sheet_row, i, life):
    """SUM of row over the last `life` year-columns up to i (bounded at C)."""
    start = max(0, i - life + 1)
    return f"SUM({YC[start]}{sheet_row}:{YC[i]}{sheet_row})"

cx_sec("Capex")
cx_line("cx_laptop", "Laptops & peripherals (new hires + 3-year refresh)",
        lambda i: f"=({Hc(R_NEW_HIRES, i)}+{Hc(R_FOUNDERS, i) if i == 0 else '0'})*{REF['laptop']}"
        + (f"+{Hc(R_ALL_HEADS, i-3)}*{REF['laptop']}" if i >= 3 else ""))
cx_line("cx_furn", "Furniture & fit-out (new heads)", lambda i: f"=({Hc(R_NEW_HIRES, i)}+{Hc(R_FOUNDERS, i) if i == 0 else '0'})*{REF['furniture']}")
cx_line("cx_veh", "Vehicles purchased", lambda i: f"={ser('vehicles', i)}*{REF['veh_cost']}" if i == 0 else f"=MAX(0,{ser('vehicles', i)}-{ser('vehicles', i-1)})*{REF['veh_cost']}")
cx_line("cx_site", "Site hardware at new plants (RTU, gateway, meter interface)", lambda i: f"={Rc('gross_new', i)}*{REF['site_hw']}")
cx_line("cx_total", "TOTAL CAPEX", lambda i: f"=SUM({YC[i]}{rows_cx['cx_laptop']}:{YC[i]}{rows_cx['cx_site']})", bold=True)

cx_sec("Depreciation (straight line)")
cx_line("dep_laptop", "Laptops", lambda i: f"={window_sum(rows_cx['cx_laptop'], i, 3)}/{REF['laptop_life']}")
cx_line("dep_furn", "Furniture", lambda i: f"={window_sum(rows_cx['cx_furn'], i, 5)}/{REF['furn_life']}")
cx_line("dep_veh", "Vehicles", lambda i: f"={window_sum(rows_cx['cx_veh'], i, 5)}/{REF['veh_life']}")
cx_line("dep_site", "Site hardware", lambda i: f"={window_sum(rows_cx['cx_site'], i, 5)}/{REF['site_hw_life']}")
cx_line("dep_total", "TOTAL DEPRECIATION", lambda i: f"=SUM({YC[i]}{rows_cx['dep_laptop']}:{YC[i]}{rows_cx['dep_site']})", bold=True)
C.cell(row=rows_cx['dep_laptop'], column=1).comment = Comment("Depreciation windows are hard-wired to 3 years (laptops) and 5 years (others); change the life assumptions and these windows together.", "model")

cx_sec("Refundable deposits & margin money (cash tied up, not expensed)")
cx_line("dep_rent", "Office rent deposit (balance)", lambda i: "=0" if i == 0 else f"={Oc('rent', i)}/12*{REF['rent_deposit_m']}")
cx_line("dep_exch", "Exchange membership deposit (balance)", lambda i: f"={ser('trading_active', i)}*{REF['exch_deposit']}")
cx_line("dep_margin", "Payment-security margin at exchange (balance)", lambda i: f"={Rc('traded_value', i)}*{REF['margin_pct']}")
cx_line("depo_total", "Total deposits & margin (balance)", lambda i: f"=SUM({YC[i]}{rows_cx['dep_rent']}:{YC[i]}{rows_cx['dep_margin']})", bold=True)
cx_line("depo_change", "Increase in deposits & margin (cash outflow)", lambda i: f"={YC[i]}{rows_cx['depo_total']}" if i == 0 else f"={YC[i]}{rows_cx['depo_total']}-{YC[i-1]}{rows_cx['depo_total']}")

cx_sec("Working capital")
cx_line("recv", "Receivables (balance)", lambda i: f"={Rc('r_total', i)}*{REF['recv_days']}/365")
cx_line("pay", "Payables (balance)", lambda i: f"={Oc('total', i)}*{REF['pay_days']}/365")
cx_line("nwc", "Net working capital (balance)", lambda i: f"={YC[i]}{rows_cx['recv']}-{YC[i]}{rows_cx['pay']}")
cx_line("nwc_change", "Increase in net working capital (cash outflow)", lambda i: f"={YC[i]}{rows_cx['nwc']}" if i == 0 else f"={YC[i]}{rows_cx['nwc']}-{YC[i-1]}{rows_cx['nwc']}")
def Cc(key, i): return f"'Capex & WC'!{YC[i]}{rows_cx[key]}"

# ---------------------------------------------------------------- Cash Flow
F = wb.create_sheet("Cash Flow")
style_sheet(F, {"A": 58, "B": 4, **{c: 12 for c in YC}})
F["A1"] = "Profit & loss and cash flow (INR lakh)"; F["A1"].font = TITLE
header_row(F, 3)
rows_cf = {}
frow = 4
def cf_line(key, label, fmla_fn, bold=False, fmt=NUM):
    global frow
    rows_cf[key] = frow
    F.cell(row=frow, column=1, value=label).font = BOLD if bold else BLACK
    for i in range(YEARS):
        c = F.cell(row=frow, column=3 + i, value=fmla_fn(i)); c.number_format = fmt; c.font = BOLD if bold else BLACK
    rows_cf[key] = frow
    frow += 1
def cf_sec(text):
    global frow
    section(F, frow, text); frow += 1

cf_sec("Profit & loss")
cf_line("rev", "Revenue", lambda i: f"={Rc('r_total', i)}", bold=True)
cf_line("opex", "Operating expenses", lambda i: f"=-{Oc('total', i)}")
cf_line("ebitda", "EBITDA", lambda i: f"={YC[i]}{rows_cf['rev']}+{YC[i]}{rows_cf['opex']}", bold=True)
cf_line("ebitda_m", "EBITDA margin", lambda i: f"=IF({YC[i]}{rows_cf['rev']}=0,0,{YC[i]}{rows_cf['ebitda']}/{YC[i]}{rows_cf['rev']})", fmt=PCT)
cf_line("dep", "Depreciation", lambda i: f"=-{Cc('dep_total', i)}")
cf_line("ebit", "EBIT", lambda i: f"={YC[i]}{rows_cf['ebitda']}+{YC[i]}{rows_cf['dep']}")
cf_line("interest", "Interest income on opening cash", lambda i: "=0" if i == 0 else f"=MAX(0,{YC[i-1]}{{close}})*{REF['int_rate']}")
cf_line("pbt", "Profit before tax", lambda i: f"={YC[i]}{rows_cf['ebit']}+{YC[i]}{rows_cf['interest']}")
cf_line("loss_cf", "Tax losses carried forward (closing)", lambda i: f"=MAX(0,-{YC[i]}{rows_cf['pbt']})" if i == 0 else f"=MAX(0,{YC[i-1]}{rows_cf['loss_cf']}-{YC[i]}{rows_cf['pbt']})")
cf_line("tax", "Corporate tax", lambda i: f"=-MAX(0,{YC[i]}{rows_cf['pbt']})*{REF['tax_rate']}" if i == 0 else f"=-MAX(0,{YC[i]}{rows_cf['pbt']}-{YC[i-1]}{rows_cf['loss_cf']})*{REF['tax_rate']}")
cf_line("pat", "Profit after tax", lambda i: f"={YC[i]}{rows_cf['pbt']}+{YC[i]}{rows_cf['tax']}", bold=True)

cf_sec("Cash flow")
cf_line("cf_ebitda", "EBITDA", lambda i: f"={YC[i]}{rows_cf['ebitda']}")
cf_line("cf_tax", "Tax paid", lambda i: f"={YC[i]}{rows_cf['tax']}")
cf_line("cf_int", "Interest received", lambda i: f"={YC[i]}{rows_cf['interest']}")
cf_line("cf_nwc", "Increase in working capital", lambda i: f"=-{Cc('nwc_change', i)}")
cf_line("cf_ocf", "Operating cash flow", lambda i: f"=SUM({YC[i]}{rows_cf['cf_ebitda']}:{YC[i]}{rows_cf['cf_nwc']})", bold=True)
cf_line("cf_capex", "Capital expenditure", lambda i: f"=-{Cc('cx_total', i)}")
cf_line("cf_dep", "Deposits & exchange margin money", lambda i: f"=-{Cc('depo_change', i)}")
cf_line("cf_fcf", "Free cash flow (before funding)", lambda i: f"={YC[i]}{rows_cf['cf_ocf']}+{YC[i]}{rows_cf['cf_capex']}+{YC[i]}{rows_cf['cf_dep']}", bold=True)
cf_line("cf_equity", "Equity raised", lambda i: f"={ser('equity', i)}")
cf_line("open", "Opening cash", lambda i: "=0" if i == 0 else f"={YC[i-1]}{{close}}")
cf_line("close", "Closing cash", lambda i: f"={YC[i]}{rows_cf['open']}+{YC[i]}{rows_cf['cf_fcf']}+{YC[i]}{rows_cf['cf_equity']}", bold=True)
cf_line("cum_fcf", "Cumulative free cash flow (before funding)", lambda i: f"={YC[i]}{rows_cf['cf_fcf']}" if i == 0 else f"={YC[i-1]}{rows_cf['cum_fcf']}+{YC[i]}{rows_cf['cf_fcf']}")
cf_line("min_cash", "Lowest closing cash to date (funding adequacy check: must stay ≥ 0)", lambda i: f"={YC[i]}{rows_cf['close']}" if i == 0 else f"=MIN({YC[i-1]}{rows_cf['min_cash']},{YC[i]}{rows_cf['close']})")
# patch {close} placeholders
for i in range(YEARS):
    for key in ("interest", "open"):
        cell = F[f"{YC[i]}{rows_cf[key]}"]
        if isinstance(cell.value, str) and "{close}" in cell.value:
            cell.value = cell.value.replace("{close}", str(rows_cf['close']))
F.cell(row=rows_cf['min_cash'], column=1).fill = YFILL
F.cell(row=frow + 1, column=1, value="Funding need = the most negative value of 'Cumulative free cash flow'. Equity raised on Assumptions must cover it with a buffer.").font = Font(name="Arial", italic=True, size=9)
def Fc(key, i): return f"'Cash Flow'!{YC[i]}{rows_cf[key]}"

# ---------------------------------------------------------------- Summary
S = wb.create_sheet("Summary", 0)
style_sheet(S, {"A": 58, "B": 4, **{c: 12 for c in YC}})
S["A1"] = "10-year projection — asset-light intelligence business (INR lakh)"; S["A1"].font = TITLE
S["A2"] = '=IF(Assumptions!$B$' + REF['include_cni'].split('$')[-1] + '=1,"Scenario: core business + firm-green sales to industry from FY31","Scenario: core intelligence business only (no industrial sales)")'
S["A2"].font = Font(name="Arial", italic=True, size=10, color="C00000")
header_row(S, 4)
srow = 5
def s_line(label, src_fn, fmt=NUM, bold=False):
    global srow
    S.cell(row=srow, column=1, value=label).font = BOLD if bold else BLACK
    for i in range(YEARS):
        c = S.cell(row=srow, column=3 + i, value=src_fn(i)); c.number_format = fmt; c.font = BOLD if bold else GREEN
    srow += 1
def s_sec(text):
    global srow
    section(S, srow, text); srow += 1
s_sec("Scale")
s_line("Plants under management", lambda i: f"={Rc('plants', i)}", NUM0)
s_line("Capacity under management (MW)", lambda i: f"={Rc('mw', i)}", NUM0)
s_line("Battery storage dispatched (MWh)", lambda i: f"={Rc('batt_mwh', i)}", NUM0)
s_line("Total heads incl. founders", lambda i: f"={Hc(R_ALL_HEADS, i)}", NUM0)
s_sec("Revenue by line")
for key, label in [("r_dsm", "Deviation reduction"), ("r_uplift", "Untied-power optimisation"), ("r_batt", "Battery dispatch intelligence"),
                   ("r_grid", "Ancillary & capacity share"), ("r_trade", "Trading margin"), ("r_onboard", "Onboarding fees"), ("r_cni", "Firm-green sales to industry")]:
    s_line(label, lambda i, k=key: f"={Rc(k, i)}")
s_line("TOTAL REVENUE", lambda i: f"={Rc('r_total', i)}", bold=True)
s_line("Core revenue per managed plant", lambda i: f"={Rc('r_per_plant', i)}")
s_sec("Costs & profit")
s_line("People costs (salaries, founders, statutory, commissions, recruiting, training)",
       lambda i: f"=SUM(Opex!{YC[i]}{rows_op['salaries']}:Opex!{YC[i]}{rows_op['training']})")
s_line("Office & admin", lambda i: f"=SUM(Opex!{YC[i]}{rows_op['rent']}:Opex!{YC[i]}{rows_op['consumables']})")
s_line("Technology & site operations", lambda i: f"=SUM(Opex!{YC[i]}{rows_op['cloud']}:Opex!{YC[i]}{rows_op['install']})")
s_line("Regulatory, legal, insurance", lambda i: f"=SUM(Opex!{YC[i]}{rows_op['licence']}:Opex!{YC[i]}{rows_op['insurance']})")
s_line("Travel & vehicles", lambda i: f"=SUM(Opex!{YC[i]}{rows_op['travel']}:Opex!{YC[i]}{rows_op['cabs']})")
s_line("Marketing, pilots, bank, bad debts, contingency",
       lambda i: f"=SUM(Opex!{YC[i]}{rows_op['marketing']}:Opex!{YC[i]}{rows_op['baddebt']})+{Oc('contingency', i)}")
s_line("TOTAL OPEX", lambda i: f"={Oc('total', i)}", bold=True)
s_line("EBITDA", lambda i: f"={Fc('ebitda', i)}", bold=True)
s_line("EBITDA margin", lambda i: f"={Fc('ebitda_m', i)}", PCT)
s_line("Profit after tax", lambda i: f"={Fc('pat', i)}", bold=True)
s_sec("Cash")
s_line("Capex", lambda i: f"={Fc('cf_capex', i)}")
s_line("Free cash flow (before funding)", lambda i: f"={Fc('cf_fcf', i)}", bold=True)
s_line("Equity raised", lambda i: f"={Fc('cf_equity', i)}")
s_line("Closing cash", lambda i: f"={Fc('close', i)}", bold=True)
s_line("Cumulative free cash flow", lambda i: f"={Fc('cum_fcf', i)}")
srow += 1
S.cell(row=srow, column=1, value="Peak funding need (INR lakh)").font = BOLD
S.cell(row=srow, column=3, value=f"=-MIN('Cash Flow'!C{rows_cf['cum_fcf']}:L{rows_cf['cum_fcf']})").number_format = NUM0
srow += 1
S.cell(row=srow, column=1, value="First EBITDA-positive year").font = BOLD
S.cell(row=srow, column=3, value=f'=IFERROR(INDEX($C$4:$L$4,MATCH(TRUE,INDEX(\'Cash Flow\'!C{rows_cf["ebitda"]}:L{rows_cf["ebitda"]}>0,0),0)),"none in 10 yrs")')
srow += 1
S.cell(row=srow, column=1, value="10-year cumulative revenue (INR crore)").font = BOLD
S.cell(row=srow, column=3, value=f"=SUM(Revenue!C{rows_rev['r_total']}:L{rows_rev['r_total']})/100").number_format = NUM
srow += 1
S.cell(row=srow, column=1, value="10-year cumulative PAT (INR crore)").font = BOLD
S.cell(row=srow, column=3, value=f"=SUM('Cash Flow'!C{rows_cf['pat']}:L{rows_cf['pat']})/100").number_format = NUM

# ---------------------------------------------------------------- README
Rd = wb.create_sheet("README", 1)
style_sheet(Rd, {"A": 120})
lines = [
    ("How to use this model", TITLE),
    ("All figures are INR lakh (100 lakh = 1 crore). Years FY2027 (Y1) to FY2036 (Y10).", BLACK),
    ("BLUE cells on 'Assumptions' and 'Headcount' are inputs: change them and every sheet recalculates. BLACK cells are formulas. GREEN cells link to another sheet. Do not type over black or green cells.", BLACK),
    ("Scenario switch: Assumptions → 'SCENARIO SWITCH: include firm-green sales to industry' (yellow). 1 = core intelligence business plus selling firm green power to factories from FY31. 0 = pure intelligence business.", BLACK),
    ("Funding: set 'Equity raised' on Assumptions so that 'Lowest closing cash to date' on Cash Flow never goes below zero. 'Peak funding need' on Summary tells you the minimum.", BLACK),
    ("", BLACK),
    ("What the business is", BOLD),
    ("Plant owners own their batteries. We supply forecasting, 15-minute scheduling, exchange bidding (day-ahead and real-time), battery dispatch, deviation management, site telemetry and, from Y3, a Category V trading licence. We are paid a share of value created: deviation charges avoided, exchange upside on untied power, battery arbitrage, and later ancillary/capacity payments. No per-MW software fee.", BLACK),
    ("", BLACK),
    ("Where the numbers come from", BOLD),
    ("Market figures (deviation charges per MW, arbitrage per MWh, spread compression, mandate timing, licence costs) are drawn from the research notes in /research_notes/Energy exchange startup opportunity/ and the report in /reports/. They were gathered from search-result extracts on 14 Nov 2026, not full primary documents; treat them as order-of-magnitude. Cost items (salaries, rent, travel, vehicles, fees) are the author's estimates of 2026 Indian market rates and are flagged as such in the notes column of Assumptions.", BLACK),
    ("", BLACK),
    ("Key untested assumptions (test before trusting the model)", BOLD),
    ("1. We can avoid 30% of a plant's deviation charges (dsm_recov). Below 20% the deviation line does not pay for itself.", BLACK),
    ("2. Block-by-block selling adds INR 0.50/kWh to untied power in FY27, compressing to INR 0.25 by FY31.", BLACK),
    ("3. Ancillary and capacity markets open to aggregated storage by FY31 (grid_active). Pure regulatory risk.", BLACK),
    ("4. The sales ramp to 100 plants by FY31 against ~1,500 qualifying mid-size plants.", BLACK),
    ("5. Trading margin of INR 0.02/kWh is within the CERC cap; verify the current cap and structure fees as optimisation services.", BLACK),
    ("", BLACK),
    ("Simplifications", BOLD),
    ("Straight-line depreciation with windows hard-wired to 3 years (laptops) and 5 years (others). No debt. Tax at 25.17% with full loss carry-forward and no MAT. GST treated as pass-through. ESOP pool is non-cash and not modelled. Revenue recognised evenly in the year a plant is counted; a plant added in Y3 earns a full Y3 (slightly optimistic).", BLACK),
]
for k, (text, font) in enumerate(lines, start=1):
    c = Rd.cell(row=k, column=1, value=text); c.font = font; c.alignment = Alignment(wrap_text=True, vertical="top")

# freeze panes
for ws in (A, H, Rv, O, C, F, S):
    ws.freeze_panes = "C4"

out = "/home/user/Play/model/Energy_intelligence_10yr_model.xlsx"
wb.save(out)
print("saved", out)
