# Features Research: CreditFix

**Domain:** AI-powered credit repair / FCRA dispute automation
**Date:** 2026-04-03
**Confidence:** HIGH

## Table Stakes (Must Have)

Features users expect from any credit repair tool. Missing these = product feels broken.

| Feature | Description | Complexity | Dependencies |
|---------|-------------|------------|-------------|
| PDF Upload & Ingestion | Upload credit report PDFs from all 3 bureaus | Medium | Storage, parser |
| Multi-Bureau Support | Handle Experian, Equifax, TransUnion formats | High | Bureau-specific parsers |
| Tradeline Extraction | Parse account details: creditor, balance, status, dates, payment history | High | PDF parser |
| Negative Item Identification | Identify late payments, collections, charge-offs, public records | Medium | Parser + AI |
| Dispute Letter Generation | Generate formal letters citing FCRA sections with correct bureau addresses | Medium | User profile, dispute items |
| Letter Export/Download | Download letters as print-ready documents | Low | PDF generation |
| Status Tracking | Track dispute lifecycle: pending → sent → waiting → resolved | Medium | Database, UI |
| 30-Day Deadline Tracking | FCRA requires bureaus to respond within 30 days; track and alert | Medium | Date logic, notifications |
| Secure Data Handling | Never store full SSNs; encrypt sensitive data; RLS | Medium | Auth, database design |
| User Review Before Action | User must approve each dispute item before letter generation | Low | UI flow |

## Differentiators (Competitive Advantage)

Features that set this tool apart from manual dispute processes or basic templates.

| Feature | Description | Complexity | Dependencies |
|---------|-------------|------------|-------------|
| AI-Powered Analysis | Claude identifies disputable items with legal reasoning, not just templates | High | Claude API, structured prompts |
| FCRA Section Citation | AI provides specific FCRA section references for each dispute reason | Medium | Legal knowledge in prompts |
| Personalized Letters | AI crafts item-specific language, not boilerplate templates | Medium | Claude API, dispute items |
| Bureau Response Parsing | Upload bureau response letters; AI analyzes and suggests next steps | High | PDF parser, Claude API |
| Escalation Workflow | Auto-generate second demand letters for ignored disputes; suggest CFPB complaints | Medium | Dispute tracker, letter generator |
| Round Management | Track dispute rounds (first letter, follow-up, escalation) per item | Medium | Database schema |
| Dashboard Analytics | Summary cards showing dispute progress, success rates, timeline | Low | Database queries, charts |
| Certified Mail Tracking | Record USPS tracking numbers; anchor 30-day clock to delivery date | Low | UI input, date logic |

## Anti-Features (Deliberately NOT Building)

| Feature | Why NOT | Risk if Built |
|---------|---------|---------------|
| Automatic letter mailing | User must send herself; maintains personal control and avoids CROA issues | Legal exposure, user trust |
| Credit score simulation | FICO scoring is proprietary; predictions would be inaccurate and misleading | User disappointment, liability |
| Mass dispute (everything at once) | FCRA § 611(a)(3) allows bureaus to reject frivolous disputes | Disputes rejected, user harmed |
| Debt settlement/negotiation | Different domain, different legal framework; out of scope | Scope creep, legal complexity |
| Credit monitoring integration | Requires paid API subscriptions; user can check annualcreditreport.com free | Unnecessary cost and complexity |
| Legal advice generation | AI cannot and should not provide legal advice | Liability, ethical concerns |
| Guaranteed removal language | FCRA disputes are requests for investigation, not demands for removal | Misleading, potential legal issues |
| Auto-bureau account creation | Scraping bureau sites violates ToS; manual process is safer | ToS violation, account bans |
| Multi-user/commercial features | Single user tool; avoids CROA regulation entirely | Regulatory complexity |

## Feature Dependencies

```
Upload PDF
  └── Parse PDF (bureau-specific extraction)
       └── AI Analysis (identify disputable items)
            └── User Review (approve/skip items)
                 └── Generate Letters (bureau-specific, FCRA-cited)
                      └── Download PDF Letters
                           └── Mark as Sent (enter tracking #, start clock)
                                └── Track Deadlines (30-day countdown)
                                     └── Handle Response / Escalate
```

Critical path: Every feature depends on the one above it. No phase can be skipped.

## MVP Phasing Recommendation

**Build now (v1):**
- All table stakes
- AI-powered analysis, FCRA citations, personalized letters
- Dashboard with summary cards and deadline tracking
- Email reminders for approaching deadlines

**Defer (v2+):**
- Bureau response parsing (complex, lower frequency)
- Advanced escalation workflows
- Round management beyond first dispute cycle
- Detailed analytics and success rate tracking
