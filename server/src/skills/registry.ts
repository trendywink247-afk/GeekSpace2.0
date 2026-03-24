// ============================================================
// Skill Registry — Built-in India Business Skills catalog
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';
import type { SkillDefinition, SkillCategory, AgentId } from './types.js';

// ── Skill Catalog ─────────────────────────────────────────────

export const SKILL_CATALOG: SkillDefinition[] = [
  // ── 1. GST Compliance ───────────────────────────────────────
  {
    id: 'gst-compliance',
    name: 'GST Compliance Assistant',
    description: 'Complete GST knowledge — rates, filing deadlines, ITC rules, e-invoicing, HSN codes, and penalties. Answers any GST question instantly.',
    type: 'hybrid',
    tier: 'free',
    category: 'india-business',
    compatibleAgents: ['echo', 'cal', 'aria', 'pulse', 'jarvis'],
    icon: '📋',
    tags: ['gst', 'tax', 'india', 'compliance', 'invoicing'],
    skillContent: `GST COMPLIANCE KNOWLEDGE BASE

RATE STRUCTURE:
- 0%: Essential food grains (rice, wheat, fresh milk, eggs, curd), healthcare, education
- 5%: Packaged food, economy rail/air, transport, small restaurants (non-AC)
- 12%: Business-class air, processed food, IT services to government, apparels above ₹1000
- 18%: Most services (IT, consulting, telecom, banking, restaurants in hotels), most manufactured goods
- 28%: Luxury goods (cars, pan masala, aerated drinks), cement, AC restaurants in 5-star hotels
- Composition scheme: 1% (manufacturers), 5% (restaurants), 6% (other service providers) — turnover up to ₹1.5 crore

CGST/SGST/IGST:
- Intra-state supply: CGST + SGST (each = half of total GST rate). Example: 18% = 9% CGST + 9% SGST
- Inter-state supply: IGST (full rate). Example: 18% IGST
- Imports: IGST applies (treated as inter-state supply)
- Place of supply rules determine intra vs inter-state: goods = delivery location, services = recipient location

FILING DEADLINES:
- GSTR-1 (outward supplies): 11th of next month (monthly filers), 13th of month after quarter (QRMP)
- GSTR-3B (summary return): 20th of next month (monthly), 22nd/24th of month after quarter (QRMP)
- GSTR-9 (annual): December 31st of next financial year
- GSTR-9C (reconciliation statement): December 31st, mandatory if turnover > ₹5 crore
- IFF (Invoice Furnishing Facility): 13th of month after each quarter month (QRMP optional)
- CMP-08 (composition): 18th of month after quarter

REGISTRATION THRESHOLDS:
- Goods: ₹40 lakhs aggregate turnover (₹20 lakhs for special category states)
- Services: ₹20 lakhs aggregate turnover (₹10 lakhs for special category states)
- Special category states: Manipur, Mizoram, Nagaland, Tripura, Meghalaya, Arunachal Pradesh, Sikkim, Uttarakhand, Himachal Pradesh, J&K
- Mandatory registration regardless of turnover: inter-state supply, e-commerce operators, casual taxable persons, input service distributors, reverse charge agents

INPUT TAX CREDIT (ITC):
- ITC allowed only if: supplier has filed GSTR-1, invoice appears in GSTR-2B, payment made within 180 days
- GSTR-2B matching: ITC auto-populated from supplier GSTR-1 filings; reconcile monthly
- 180-day rule: if payment not made to supplier within 180 days, ITC must be reversed with interest
- Blocked credits (Section 17(5)): motor vehicles (except if used for transport/training/demo), food & beverages (except if in the business of supplying them), memberships of clubs, health & fitness, personal use items, goods lost/destroyed/written off/given as gifts
- ITC reversal on exempt/non-business use: proportionate reversal under Rule 42/43
- 5% provisional ITC cap removed (now 100% matching-based)

E-INVOICING:
- Mandatory for businesses with turnover > ₹5 crore (from Aug 2023)
- Generate IRN (Invoice Reference Number) on IRP (Invoice Registration Portal) — NIC e-Invoice portal
- JSON format upload, QR code on invoice
- B2B invoices auto-populate in GSTR-1 once e-invoice generated
- Cancellation: within 24 hours on IRP, after that issue credit note

E-WAY BILL:
- Required when goods value > ₹50,000 moved between places
- Part A: supplier details, recipient, HSN, value, transport mode
- Part B: vehicle number, transporter ID
- Validity: up to 200 km = 1 day; every additional 200 km = 1 extra day
- Exemptions: goods exempt from GST, defence, LPG for household, kerosene, postal, currency

HSN REQUIREMENTS:
- Turnover up to ₹5 crore: 4-digit HSN code mandatory
- Turnover above ₹5 crore: 6-digit HSN code mandatory
- Common codes: 9954 (construction), 9971 (financial services), 9983 (IT services), 9985 (support services), 8471 (computers), 6109 (T-shirts), 8517 (telecom equipment), 2106 (food preparations)

PENALTIES:
- Late filing: ₹50/day (₹25 CGST + ₹25 SGST), capped at ₹5,000 per return
- Nil return late filing: ₹20/day (₹10 CGST + ₹10 SGST)
- Interest on late payment: 18% p.a. on tax payable
- E-invoice non-compliance: ₹25,000 penalty per invoice (Section 122)
- Fake invoice/fraud: 100% tax + penalty, imprisonment up to 5 years`,
  },

  // ── 2. UPI Reconciliation ───────────────────────────────────
  {
    id: 'upi-reconciliation',
    name: 'UPI Reconciliation Toolkit',
    description: 'UTR tracking, settlement cycles, dispute handling, MDR policy, and bank statement reconciliation for UPI payments.',
    type: 'tool',
    tier: 'pro',
    category: 'finance',
    compatibleAgents: ['pulse', 'jarvis', 'echo'],
    icon: '💸',
    tags: ['upi', 'payments', 'reconciliation', 'banking', 'india'],
    skillContent: `UPI RECONCILIATION KNOWLEDGE BASE

UTR FORMAT:
- 12-digit alphanumeric string, unique per transaction
- Format varies by bank: HDFC (H + 11 digits), SBI (S + 11 digits), ICICI (I + 11 digits)
- UTR = Unique Transaction Reference, generated by remitter bank
- RRN (Retrieval Reference Number): 12-digit, used by NPCI for tracking
- UPI transaction ID format: Bank UPI handle + timestamp hash (e.g., AXIS123456789012)

SETTLEMENT CYCLES:
- T+0: real-time settlement for most UPI transactions (instant credit)
- T+1: some merchant settlements (especially via payment aggregators like Razorpay, PayU, Cashfree)
- Batch settlement: aggregators typically batch at EOD, settle next morning
- Holiday/weekend: T+1 may extend to T+2 if next day is holiday
- Cross-border UPI (UPI International): T+1 to T+3 depending on corridor

DISPUTE WINDOW:
- Customer complaint: must file within 30 days of transaction
- NPCI dispute: 5 business days for resolution
- Chargeback flow: issuer bank → NPCI → acquirer bank → merchant
- Pre-arbitration: if merchant rejects, escalate within 5 days
- Arbitration: NPCI arbitration committee, binding decision within 30 days
- Deemed approved: if acquirer bank doesn't respond within 5 business days, refund auto-approved

TRANSACTION LIMITS:
- Standard P2P: ₹1,00,000 per transaction
- P2M (standard): ₹1,00,000 per transaction
- UPI Lite: ₹500 per transaction, ₹2,000 wallet balance
- Capital market, insurance, medical: ₹2,00,000 per transaction
- IPO, government tax: ₹5,00,000 per transaction
- Per-day limit: varies by bank (typically ₹1,00,000 aggregate)
- UPI Autopay: up to ₹15,000 (notifications required above ₹5,000)

MDR POLICY (Merchant Discount Rate):
- Zero MDR: P2M transactions via UPI since Jan 2020 (government mandate)
- Interchange: banks absorb cost, government provides subsidy (₹2,210 crore in FY24)
- Payment aggregator fees: 0.5%-2% charged by PAs (Razorpay, Stripe India, etc.) — this is PA fee, not MDR
- UPI QR: zero MDR for all merchant categories

BANK STATEMENT PARSING:
- Key fields: date, narration/description, debit/credit amount, balance, UTR/reference
- UPI narration patterns: "UPI/<VPA>/<UTR>/<remark>" or "UPI-<bank ref>-<VPA>"
- CSV/OFX/MT940 formats supported by most banks
- Common mismatches: timezone differences (IST vs UTC), rounding (paise handling), duplicate narrations

RECONCILIATION METHODOLOGY:
1. Extract: pull bank statements (API or CSV) + UPI settlement reports
2. Normalize: standardize date format (IST), amount to paise (integer), trim UTR/RRN
3. Match: primary key = UTR; fallback = amount + date + VPA within ±1 day window
4. Flag mismatches: unmatched bank entries (unexpected credits/debits), unmatched UPI entries (pending settlement)
5. Investigate: check NPCI dashboard for pending/failed status, contact bank for >5-day unmatched
6. Close: mark reconciled entries, generate exception report for unmatched items

COMMON ISSUES:
- Deemed success with actual failure: money debited but not credited — raise complaint via NPCI
- Double debit: network timeout causes retry — check UTR uniqueness
- Refund not received: 3-5 business days for auto-reversal; if not, file UPI complaint on BHIM/bank app
- VPA mismatch in statement: bank may truncate or format VPA differently`,
  },

  // ── 3. Hindi Business Writing ───────────────────────────────
  {
    id: 'hindi-business-writing',
    name: 'Hindi Business Writing',
    description: 'Professional Hindi and Hinglish writing — formal letters, business emails, culturally appropriate communication with templates and style guides.',
    type: 'knowledge',
    tier: 'free',
    category: 'communication',
    compatibleAgents: ['aria', 'echo', 'cal'],
    icon: '✍️',
    tags: ['hindi', 'hinglish', 'writing', 'business', 'india', 'communication'],
    skillContent: `HINDI BUSINESS WRITING KNOWLEDGE BASE

THREE WRITING MODES:

1. FORMAL HINDI (शुद्ध हिन्दी):
   Use for: government correspondence, official letters, legal documents, formal proposals
   Script: Devanagari only
   Style: तत्सम (Sanskrit-derived) vocabulary, full honorifics, formal sentence structure
   Example opening: "सेवा में, श्रीमान/श्रीमती [नाम], [पद], [संस्था]"
   Example closing: "सादर, [नाम], [पद]"

2. BUSINESS HINGLISH:
   Use for: startup communication, tech teams, modern business emails, Slack/Teams messages
   Script: Roman (English) script
   Style: English structure with Hindi words for warmth/emphasis
   Example: "Aapka proposal reviewed — numbers solid hai, but market sizing thoda aggressive lag raha hai. Let's sync tomorrow and finalize the deck."
   Rules: technical terms in English, emotions/emphasis in Hindi, no forced Hindi for jargon

3. MIXED FORMAL:
   Use for: client emails, semi-formal business communication, internal memos
   Script: Roman or Devanagari based on recipient preference
   Style: professional tone with natural code-switching
   Example: "Dear [Name] ji, hope aap well hain. Attached hai the Q3 report. Revenue targets hit ho gaye, but cost optimization pe we need to discuss further."

LETTER TEMPLATES:

Business Proposal (Formal):
"विषय: [प्रस्ताव शीर्षक]
महोदय/महोदया,
सविनय निवेदन है कि [कंपनी] की ओर से हम आपके समक्ष [प्रस्ताव] प्रस्तुत करना चाहते हैं।
[मुख्य बिंदु]
कृपया इस प्रस्ताव पर विचार करें। हम आपकी सुविधानुसार बैठक हेतु उपलब्ध हैं।
सादर,
[नाम]"

Business Email (Hinglish):
"Hi [Name] ji,
Hope you're doing well. [Main topic] ke baare mein update share kar raha/rahi hoon.
[Key points in natural Hinglish]
Please let me know if koi questions hain. Happy to discuss further.
Best regards,
[Name]"

Follow-up (Mixed):
"[Name] ji, ek gentle reminder regarding [topic]. Last email mein shared the details — kya aapko review karne ka time mila?
No rush, but agar is week respond ho jaaye toh hum timeline pe reh sakte hain.
Thanks & regards,
[Name]"

CULTURAL NUANCES:
- ji suffix: ALWAYS add "ji" after names in Hindi/Hinglish communication (shows respect)
- आप vs तुम: always use "आप" (formal you) in business; "तुम" only with very close peers after they initiate
- Festival greetings: include brief wishes during Diwali, Holi, Eid, Christmas, Navratri when contextually appropriate
- Indirect disagreement: prefer "yeh thoda challenging ho sakta hai" over "yeh galat hai"; soften with "shayad" or "ho sakta hai"
- Hierarchy awareness: address seniors with full honorifics; include "sir/ma'am" or "ji" consistently
- Time references: use "kal" (tomorrow/yesterday — context-dependent), "parson" (day after/before), avoid ambiguity by adding dates
- Sign-off hierarchy: "dhanyavaad" (thanks), "saadar" (respectful), "kripya" (please — formal)

OUTPUT RULES:
- Formal Hindi → ALWAYS use Devanagari script
- Business Hinglish → ALWAYS use Roman script
- Mixed → match recipient preference; when uncertain, use Roman
- Never mix Devanagari and Roman in the same sentence
- Transliterate consistently: use ITRANS-like spellings (aa, ee, oo) for long vowels`,
  },

  // ── 4. Indian Labor Compliance ──────────────────────────────
  {
    id: 'indian-labor-compliance',
    name: 'Indian Labor Compliance',
    description: 'EPF, ESI, TDS, and payroll compliance for Indian employers — contribution rates, thresholds, filing deadlines, and new tax regime slabs.',
    type: 'hybrid',
    tier: 'pro',
    category: 'india-business',
    compatibleAgents: ['echo', 'cal', 'pulse', 'jarvis'],
    icon: '⚖️',
    tags: ['epf', 'esi', 'tds', 'payroll', 'compliance', 'india', 'labor'],
    skillContent: `INDIAN LABOR COMPLIANCE KNOWLEDGE BASE

EPF (Employees' Provident Fund):
- Employee contribution: 12% of basic + DA
- Employer contribution: 12% of basic + DA, split as:
  - 8.33% → EPS (Employee Pension Scheme), capped at ₹15,000 basic per month
  - 3.67% → EPF (Provident Fund) — balance after EPS
- EPS cap: if basic > ₹15,000/month, EPS stays at ₹1,250/month (8.33% of ₹15,000), rest goes to EPF
- Admin charges: 0.50% of basic + DA (employer pays, minimum ₹75 if contributions <₹75)
- EDLI (Employee Deposit Linked Insurance): 0.50% of basic + DA (employer pays)
- Applicability: establishments with 20+ employees; voluntary for smaller
- Registration: within 1 month of reaching 20 employees
- Withdrawal: partial for medical (7 years), housing (5 years), marriage (7 years); full at 58 or 2 months unemployment
- UAN (Universal Account Number): portable across employers

ESI (Employee State Insurance):
- Employee contribution: 0.75% of gross wages
- Employer contribution: 3.25% of gross wages
- Wage threshold: applicable if gross wages ≤ ₹21,000/month (₹25,000 for disabled)
- Coverage: medical, sickness, maternity, disability, dependent, funeral benefits
- Applicability: establishments with 10+ employees (some states: 20+)
- Filing: monthly contribution by 15th of following month via ESIC portal
- IP (Insured Person) gets: free medical at ESIC hospitals/dispensaries, 70% wage during sickness (up to 91 days), maternity benefit for 26 weeks (100% wages)

TDS (Tax Deducted at Source) — NEW REGIME (AY 2025-26):
- ₹0 – ₹4,00,000: Nil
- ₹4,00,001 – ₹8,00,000: 5%
- ₹8,00,001 – ₹12,00,000: 10%
- ₹12,00,001 – ₹16,00,000: 15%
- ₹16,00,001 – ₹20,00,000: 20%
- ₹20,00,001 – ₹24,00,000: 25%
- Above ₹24,00,000: 30%
- Standard deduction: ₹75,000 (new regime)
- Section 87A rebate: income up to ₹12,00,000 → zero tax (after standard deduction, effective ₹12,75,000)
- Surcharge: 10% (₹50L–₹1Cr), 15% (₹1Cr–₹2Cr), 25% (₹2Cr–₹5Cr), 37% (above ₹5Cr) — new regime caps at 25%
- Cess: 4% health & education cess on total tax + surcharge
- New regime is DEFAULT from AY 2024-25; opt out for old regime via Form 10-IEA

OLD REGIME (for comparison):
- ₹0 – ₹2,50,000: Nil (₹3L for seniors, ₹5L for super seniors)
- ₹2,50,001 – ₹5,00,000: 5%
- ₹5,00,001 – ₹10,00,000: 20%
- Above ₹10,00,000: 30%
- Deductions available: 80C (₹1.5L), 80D (₹25K/₹50K), HRA, LTA, NPS (80CCD: ₹50K extra)

FILING DEADLINES:
- ECR (Electronic Challan cum Return) for EPF: 15th of following month
- ESI contribution: 15th of following month
- TDS deposit: 7th of following month (government deductors: same day)
- 24Q (TDS quarterly return for salaries): 31st July / 31st Oct / 31st Jan / 31st May
- Form 16 (TDS certificate to employees): June 15th
- Form 16A (non-salary TDS certificate): within 15 days of filing quarterly return
- PF annual return: April 30th
- ESI half-yearly return: abolished (now monthly challan only)

PROFESSIONAL TAX (state-level):
- Maharashtra: ₹200/month (salary > ₹10,000), ₹300 for Feb (annual ₹2,500)
- Karnataka: ₹200/month (salary > ₹15,000)
- Tamil Nadu: ₹208/month (half-yearly ₹1,250)
- Varies by state; employer deducts and deposits monthly/half-yearly
- Maximum allowed: ₹2,500/year per employee (Constitution cap)

GRATUITY:
- Applicable: 5+ years continuous service, establishments with 10+ employees
- Calculation: (last drawn salary × 15 × years of service) / 26
- Maximum: ₹20,00,000 (tax-exempt up to this amount)
- "Last drawn salary" = basic + DA

MINIMUM WAGES:
- Set by Central/State government, varies by state, skill level, and industry
- Central minimum: ₹178/day for unskilled workers in scheduled employment
- Revised semi-annually or annually depending on state
- VDA (Variable Dearness Allowance) updated twice a year (linked to CPI)`,
  },

  // ── 5. Tally Integration ────────────────────────────────────
  {
    id: 'tally-integration',
    name: 'Tally Integration',
    description: 'Tally Prime XML API, ODBC connections, voucher creation, GST in Tally, and ledger management for accounting automation.',
    type: 'tool',
    tier: 'pro',
    category: 'india-business',
    compatibleAgents: ['jarvis', 'pulse', 'forge'],
    icon: '📒',
    tags: ['tally', 'accounting', 'xml', 'india', 'automation', 'integration'],
    skillContent: `TALLY INTEGRATION KNOWLEDGE BASE

XML API FORMAT:
- Tally exposes HTTP API on port 9000 (default)
- Request: POST to http://localhost:9000 with Content-Type: text/xml
- Envelope: <ENVELOPE><HEADER>...</HEADER><BODY>...</BODY></ENVELOPE>
- Header specifies request type: <TYPE>Export</TYPE> or <TYPE>Import</TYPE>
- ID tag: <ID>All Ledgers</ID>, <ID>All Masters</ID>, <ID>Voucher</ID>, etc.

ODBC CONNECTION:
- Tally ODBC driver: install from Tally downloads
- DSN: "Tally ODBC 64" or "Tally ODBC 32"
- Connection string: DSN=Tally ODBC 64;Server=localhost;Port=9000;Company=MyCompany
- Tables exposed: Ledger, Group, StockItem, Voucher, CostCentre, Currency, Budget
- SQL syntax subset: SELECT, WHERE, ORDER BY supported; JOINs limited

VOUCHER TYPES:
- Sales: credit ledger (party), debit ledger (sales account), GST ledgers
- Purchase: debit ledger (party), credit ledger (purchase account), GST ledgers
- Receipt: debit ledger (bank/cash), credit ledger (party) — money received
- Payment: credit ledger (bank/cash), debit ledger (party) — money paid
- Journal: debit + credit entries for adjustments, provisions, accruals
- Contra: transfers between cash and bank accounts
- Credit Note: reversal of sales (linked to original invoice)
- Debit Note: reversal of purchase (linked to original invoice)
- Each voucher has: date, narration, party name, ledger entries with amounts

GST IN TALLY:
- Enable: F11 → Statutory & Taxation → Enable GST = Yes
- GSTIN: set per company; multiple GSTINs for branches
- Tax ledgers: create CGST, SGST, IGST, Cess ledgers under "Duties & Taxes"
- HSN mapping: set at stock item level or stock group level
- GST classification: configure rate, HSN, tax type per item
- GSTR-1 export: Gateway → Display → Statutory Reports → GST → GSTR-1 → Export (JSON format for portal upload)
- GSTR-3B: auto-computed from voucher entries; export/verify before filing
- E-invoice: Tally Prime 4.0+ supports direct IRN generation from sales voucher

LEDGER FETCH XML:
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Accounts</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>MyCompanyName</SVCURRENTCOMPANY>
          <EXPLODEFLAG>Yes</EXPLODEFLAG>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>

Response returns <TALLYMESSAGE> with <LEDGER> nodes containing NAME, PARENT, OPENINGBALANCE, CLOSINGBALANCE.

VOUCHER CREATION XML:
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>20260323</DATE>
            <NARRATION>Invoice #INV-001</NARRATION>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>Customer Name</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Customer Name</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-11800</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>10000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>CGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>900</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>SGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>900</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>

AMOUNTS: negative = debit (receiving money/goods), positive = credit (giving money/goods). Party ledger is debited in sales (they owe you).

COMMON OPERATIONS:
- Day Book: export all vouchers for a date range
- Trial Balance: export balances of all ledgers
- Outstanding: export receivables/payables with ageing
- Stock Summary: export item-wise stock position with valuation
- Bank Reconciliation: export BRS with unreconciled entries

TALLY PRIME TIPS:
- Company path: usually C:\\Users\\[User]\\AppData\\Local\\Tally\\TallyPrime\\Data\\[CompanyNumber]
- Backup: .900 files in company folder; schedule via Tally > F1 > Backup
- Multi-user: requires Tally.NET for remote access (port 9000 must be open)
- API timeout: default 60s; increase for large exports via TIMEOUT tag in request`,
  },
];

// ── Lookup Functions ──────────────────────────────────────────

export function getSkillById(id: string): SkillDefinition | undefined {
  return SKILL_CATALOG.find(s => s.id === id);
}

export function getSkillsByCategory(cat: SkillCategory): SkillDefinition[] {
  return SKILL_CATALOG.filter(s => s.category === cat);
}

export function getSkillsForAgent(agent: AgentId): SkillDefinition[] {
  return SKILL_CATALOG.filter(s => s.compatibleAgents.includes(agent));
}

// ── Seed Skills to DB ─────────────────────────────────────────

export function seedSkillsToDb(): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO skills (id, name, description, type, tier, category, compatible_agents, icon, tags, skill_content, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const transaction = db.transaction(() => {
    for (const skill of SKILL_CATALOG) {
      insert.run(
        skill.id,
        skill.name,
        skill.description,
        skill.type,
        skill.tier,
        skill.category,
        JSON.stringify(skill.compatibleAgents),
        skill.icon,
        JSON.stringify(skill.tags),
        skill.skillContent,
      );
    }
  });

  try {
    transaction();
    logger.info({ count: SKILL_CATALOG.length }, 'Skills seeded to DB');
  } catch (err) {
    logger.warn({ err }, 'Skills seed skipped (table may not exist yet)');
  }
}
