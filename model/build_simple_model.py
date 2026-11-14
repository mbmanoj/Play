from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter as L
wb = Workbook(); ws = wb.active; ws.title = "Model"
BLUE = Font(name="Arial", size=11, color="0000FF"); BLK = Font(name="Arial", size=11); B = Font(name="Arial", size=11, bold=True)
T = Font(name="Arial", size=14, bold=True); H = Font(name="Arial", size=11, bold=True, color="FFFFFF")
HF = PatternFill("solid", fgColor="1F3864"); SF = PatternFill("solid", fgColor="D9E1F2"); YF = PatternFill("solid", fgColor="FFFF99")
CR = '#,##0.0;(#,##0.0);-'; PCT = '0%'; N0 = '#,##0;(#,##0);-'
ws.column_dimensions["A"].width = 52; ws.column_dimensions["B"].width = 11
for i in range(10): ws.column_dimensions[L(3 + i)].width = 9
ws.column_dimensions["M"].width = 46
ws.sheet_view.showGridLines = False
ws["A1"] = "Battery SaaS — simple 10-year model (₹ crore)"; ws["A1"].font = T
ws["A2"] = "Change the blue cells. Everything else recalculates. One 100 MW solar plant with a battery; the startup sells the software that runs it."
ws["A2"].font = Font(name="Arial", size=10, italic=True)

r = 4
def sec(t):
    global r
    ws.cell(row=r, column=1, value=t).font = B
    for c in range(1, 13): ws.cell(row=r, column=c).fill = SF
    r += 1
IN = {}
def inp(key, label, val, fmt=CR, note=""):
    global r
    ws.cell(row=r, column=1, value=label).font = BLK
    c = ws.cell(row=r, column=2, value=val); c.font = BLUE; c.number_format = fmt; c.fill = YF
    if note: ws.cell(row=r, column=13, value=note).font = Font(name="Arial", size=9, italic=True, color="666666")
    IN[key] = f"$B${r}"; r += 1

sec("INPUTS — the battery")
inp("mwh", "Battery size at the plant (MWh)", 140, N0, "Sized to deliver 25 MW for 4 evening hours, with buffers. ~1.4 MWh per MW of plant.")
inp("mw", "Battery power (MW)", 35, N0)
inp("price", "Battery price (₹ crore per MWh, turnkey)", 0.9, '0.00', "Market price 2026. Tender bids imply 0.7–0.8.")
inp("shift", "Energy shifted into the evening each year (MWh)", 34400, N0, "From the sizing sheet: 97% of evenings served, after monsoon and cloudy days.")
inp("peak", "Evening selling price, year 1 (₹ per unit)", 8.0, '0.00')
inp("noon", "Value of the midday power used to charge (₹ per unit)", 1.6, '0.00', "₹2 noon price, 20% of it would have been curtailed anyway.")
inp("fade", "How much the evening-noon gap shrinks each year until the floor", 0.10, PCT, "More batteries → smaller gap. Texas, Australia, UK all saw this.")
inp("floor", "Floor: gap never falls below this share of year 1", 0.50, PCT)
inp("om", "Battery O&M + insurance (% of price per year)", 0.018, '0.0%')
inp("rte", "Round-trip efficiency", 0.86, PCT)
sec("INPUTS — the loan and tax")
inp("debt", "Loan as share of battery price", 0.70, PCT)
inp("rate", "Interest rate", 0.10, PCT)
inp("tenor", "Loan tenor (years)", 12, N0)
inp("tax", "Tax rate", 0.25, PCT)
sec("INPUTS — what we charge")
inp("fee", "Fixed fee (₹ lakh per battery MW per year)", 1.2, '0.0')
inp("share", "Our share of what the battery earns", 0.10, PCT)
inp("uplift", "How much more the battery earns with our software vs a simple timer", 0.30, PCT, "Timer dispatch misses price spikes, zero-price blocks and curtailment events.")
sec("INPUTS — the startup")
PL_ROW = r
ws.cell(row=r, column=1, value="Plants signed up (cumulative, 100 MW each)").font = BLK
for i, v in enumerate([3, 8, 18, 32, 50, 70, 90, 110, 128, 145]):
    c = ws.cell(row=r, column=3 + i, value=v); c.font = BLUE; c.number_format = N0; c.fill = YF
r += 1
TEAM_ROW = r
ws.cell(row=r, column=1, value="Team and office cost (₹ crore per year)").font = BLK
for i, v in enumerate([6.5, 8.5, 12, 16, 20, 24, 29, 33, 36, 39]):
    c = ws.cell(row=r, column=3 + i, value=v); c.font = BLUE; c.number_format = CR; c.fill = YF
ws.cell(row=r, column=13, value="Salaries incl. 2 founders at ₹4 lakh/month, rent, legal, travel, vehicles, marketing. 20 → 105 people.").font = Font(name="Arial", size=9, italic=True, color="666666")
r += 1
inp("varcost", "Running cost per plant (₹ lakh per year: cloud, data, telemetry, site visits)", 8, '0.0')
inp("onboard", "One-time set-up cost per new plant (₹ lakh: hardware + commissioning)", 8, '0.0')
inp("onbfee", "One-time set-up fee we charge per new plant (₹ lakh)", 15, '0.0')
inp("equity", "Equity raised in year 1 (₹ crore)", 12, CR)

r += 1
YR = r
ws.cell(row=r, column=1, value="₹ crore").font = H; ws.cell(row=r, column=1).fill = HF; ws.cell(row=r, column=2).fill = HF
for i in range(10):
    c = ws.cell(row=r, column=3 + i, value=f"Year {i+1}"); c.font = H; c.fill = HF; c.alignment = Alignment(horizontal="center")
r += 1
ROW = {}
def line(key, label, fn, fmt=CR, bold=False):
    global r
    ROW[key] = r
    ws.cell(row=r, column=1, value=label).font = B if bold else BLK
    for i in range(10):
        c = ws.cell(row=r, column=3 + i, value=fn(i)); c.number_format = fmt; c.font = B if bold else BLK
    r += 1
def col(i): return L(3 + i)
def R(key, i): return f"{col(i)}{ROW[key]}"

sec("THE PLANT OWNER — one 100 MW plant with its battery")
line("gap", "Evening-noon price gap this year (₹ per unit)", lambda i: f"=({IN['peak']}-{IN['noon']})*MAX({IN['floor']},(1-{IN['fade']})^{i})", '0.00')
line("earn", "Battery earns (energy shifted × gap, after charging losses)", lambda i: f"={IN['shift']}*({IN['noon']}+{R('gap', i)}-{IN['noon']}/{IN['rte']})/10000")
line("fees", "Fees to us", lambda i: f"=-({IN['mw']}*{IN['fee']}/100+{R('earn', i)}*{IN['share']})" + (f"-{IN['onbfee']}/100" if i == 0 else ""))
line("omc", "Battery O&M and insurance", lambda i: f"=-{IN['mwh']}*{IN['price']}*{IN['om']}")
line("ebitda", "Cash the battery makes before the loan", lambda i: f"={R('earn', i)}+{R('fees', i)}+{R('omc', i)}", bold=True)
line("emi", "Loan EMI", lambda i: f"=IF({i+1}<={IN['tenor']},PMT({IN['rate']},{IN['tenor']},{IN['mwh']}*{IN['price']}*{IN['debt']}),0)")
line("cover", "Coverage: cash ÷ EMI (bank wants ≥ 1.2)", lambda i: f"=IF({R('emi', i)}=0,0,-{R('ebitda', i)}/{R('emi', i)})", '0.00"x"')
line("intr", "  of which interest", lambda i: f"=IF({i+1}<={IN['tenor']},IPMT({IN['rate']},{i+1},{IN['tenor']},{IN['mwh']}*{IN['price']}*{IN['debt']}),0)")
line("dep", "Depreciation for tax (straight line, 10 years)", lambda i: f"=-{IN['mwh']}*{IN['price']}/10")
line("taxp", "Tax (positive = saves tax against the plant's other income)", lambda i: f"=-({R('ebitda', i)}+{R('intr', i)}+{R('dep', i)})*{IN['tax']}")
line("eqin", "Owner's own money in (year 1)", lambda i: f"=-{IN['mwh']}*{IN['price']}*(1-{IN['debt']})" if i == 0 else "=0")
line("cash", "CASH TO THE OWNER AFTER TAX", lambda i: f"={R('ebitda', i)}+{R('emi', i)}+{R('taxp', i)}+{R('eqin', i)}", bold=True)
line("cum", "Cumulative", lambda i: f"={R('cash', i)}" if i == 0 else f"={R('cum', i-1)}+{R('cash', i)}")
line("wo", "Same, WITHOUT our software (timer dispatch, no fees)", lambda i: f"=({R('earn', i)}/(1+{IN['uplift']})+{R('omc', i)})*(1-{IN['tax']})+{R('emi', i)}-({R('intr', i)}+{R('dep', i)})*{IN['tax']}+{R('eqin', i)}")
line("gain", "Owner's gain from using us, after tax", lambda i: f"={R('cash', i)}-{R('wo', i)}", bold=True)

r += 1
sec("THE STARTUP")
line("plants", "Plants under management", lambda i: f"={col(i)}{PL_ROW}", N0)
line("newp", "New plants this year", lambda i: f"={col(i)}{PL_ROW}" if i == 0 else f"=MAX(0,{col(i)}{PL_ROW}-{col(i-1)}{PL_ROW})", N0)
line("bmw", "Battery MW we run", lambda i: f"={R('plants', i)}*{IN['mw']}", N0)
line("rev", "Revenue (fees from every plant + set-up fees)", lambda i: f"=-{R('fees', i)}*{R('plants', i)}" + (f"+{R('newp', i)}*{IN['onbfee']}/100-{R('plants', i)}*{IN['onbfee']}/100" if i == 0 else f"+{R('newp', i)}*{IN['onbfee']}/100"), bold=True)
line("team", "Team and office", lambda i: f"=-{col(i)}{TEAM_ROW}")
line("var", "Running cost of plants", lambda i: f"=-{R('plants', i)}*{IN['varcost']}/100")
line("setup", "Set-up cost of new plants", lambda i: f"=-{R('newp', i)}*{IN['onboard']}/100")
line("sebitda", "Profit before tax", lambda i: f"={R('rev', i)}+{R('team', i)}+{R('var', i)}+{R('setup', i)}", bold=True)
line("lossf", "  losses carried forward", lambda i: f"=MAX(0,-{R('sebitda', i)})" if i == 0 else f"=MAX(0,{R('lossf', i-1)}-{R('sebitda', i)})")
line("stax", "Tax", lambda i: f"=-MAX(0,{R('sebitda', i)})*{IN['tax']}" if i == 0 else f"=-MAX(0,{R('sebitda', i)}-{R('lossf', i-1)})*{IN['tax']}")
line("spat", "PROFIT AFTER TAX", lambda i: f"={R('sebitda', i)}+{R('stax', i)}", bold=True)
line("scash", "Cash in the bank (after ₹ equity in year 1)", lambda i: f"={R('spat', i)}+{IN['equity']}" if i == 0 else f"={R('scash', i-1)}+{R('spat', i)}", bold=True)

r += 1
sec("THE ANSWERS")
def ans(label, f, fmt=CR):
    global r
    ws.cell(row=r, column=1, value=label).font = B
    c = ws.cell(row=r, column=3, value=f); c.number_format = fmt; c.font = B; r += 1
ans("Battery cost per plant (₹ crore)", f"={IN['mwh']}*{IN['price']}")
ans("Owner's return on their own money, 10 years", f"=IFERROR(IRR(C{ROW['cash']}:L{ROW['cash']}),\"negative\")", PCT)
ans("Owner's return WITHOUT our software", f"=IFERROR(IRR(C{ROW['wo']}:L{ROW['wo']}),\"negative\")", PCT)
ans("Owner's 10-year gain from using us (₹ crore)", f"=SUM(C{ROW['gain']}:L{ROW['gain']})")
ans("Worst loan coverage in 10 years", f"=MIN(C{ROW['cover']}:L{ROW['cover']})", '0.00"x"')
ans("Startup revenue in year 10 (₹ crore)", f"=L{ROW['rev']}")
ans("Startup 10-year profit after tax (₹ crore)", f"=SUM(C{ROW['spat']}:L{ROW['spat']})")
ans("Startup first profitable year", f'=IFERROR(INDEX($C${YR}:$L${YR},MATCH(TRUE,INDEX(C{ROW["sebitda"]}:L{ROW["sebitda"]}>0,0),0)),"none")', '@')
ans("Lowest cash balance (must stay above 0)", f"=MIN(C{ROW['scash']}:L{ROW['scash']})")
ws.freeze_panes = "C5"
out = "/home/user/Play/model/Battery_SaaS_simple.xlsx"; wb.save(out); print("saved", out)
