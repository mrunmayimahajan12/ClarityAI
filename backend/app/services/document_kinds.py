"""User-selected document family + rubric text for LLM prompts."""

from __future__ import annotations

ALLOWED_DOCUMENT_KINDS: frozenset[str] = frozenset(
    {
        "generic",
        "employment",
        "nda",
        "lease",
        "saas_terms",
        "privacy",
    }
)

_ALIASES: dict[str, str] = {
    "terms_of_service": "saas_terms",
    "tos": "saas_terms",
    "job_offer": "employment",
    "offer_letter": "employment",
}


def normalize_document_kind(raw: str | None) -> str:
    if not raw or not str(raw).strip():
        return "generic"
    k = str(raw).strip().lower().replace("-", "_")
    if k in ALLOWED_DOCUMENT_KINDS:
        return k
    return _ALIASES.get(k, "generic")


UNIVERSAL_RUBRIC = """
Risk rubric (informational, not legal advice):
- low: language is specific, mutual, or standard boilerplate with little ambiguity.
- medium: discretionary wording ("may", "subject to", "eligible"), missing key numbers or criteria,
  or obligations that depend on future approval.
- high: one-sided broad powers, unlimited liability, unilateral change without notice,
  or open-ended duties/checks with no boundaries—when the text supports it.

Ambiguity or missing material terms usually warrants at least medium when the excerpt shows
non-guaranteed compensation, unclear approval, or undefined scope.

Evidence must be quoted verbatim from the section. Do not invent clauses.
If the rule engine listed factors below, your analysis must acknowledge them explicitly.
""".strip()

EMPLOYMENT_RUBRIC_ADDENDUM = """
Employment-specific focus:
- Signing/relocation bonuses: flag medium+ if no repayment, clawback, or forfeiture clause exists
  anywhere in the document — the absence of a clawback is the risk, not the bonus itself.
- Equity: flag medium+ if terms are discretionary ("may be granted") and vesting schedule,
  strike price, or share count are absent.
- Bonuses: flag medium+ if only "eligible" or discretionary language without metrics, targets,
  or payout formula.
- Role/responsibilities: flag medium if duties "may evolve" or "change" without a defined
  process or consent requirement.
- At-will employment: flag medium when combined with no notice period; high only if paired
  with other one-sided clauses. At-will alone is not automatically high.
- Benefits referencing "company policy": this is standard boilerplate — default to low unless
  eligibility is explicitly tied to discretionary or conditional criteria.
- Non-compete/non-solicitation: flag high if scope (geography, duration, industry) is
  undefined or unusually broad.
""".strip()

NDA_RUBRIC_ADDENDUM = """
NDA-specific focus:
- One-sided vs mutual: flag high if only one party has disclosure obligations with no reciprocity.
- Definition of "Confidential Information": flag high if overly broad (e.g. "all information
  disclosed") with no carve-outs for publicly known, independently developed, or legally
  required disclosures.
- Duration: flag high if confidentiality obligations are indefinite or have no end date.
- Permitted use: flag medium+ if the permitted use of confidential information is vague or
  not limited to a stated purpose.
- Return/destruction: flag medium if there is no clause requiring return or destruction of
  materials on termination.
- Remedies: flag high if injunctive relief or disproportionate damages are specified without
  any reciprocal protection for the disclosing party.
- Standard carve-outs (public domain, prior knowledge, legal compulsion) are normal — their
  presence should not inflate the risk level.
""".strip()

LEASE_RUBRIC_ADDENDUM = """
Lease-specific focus:
- Personal guarantee: flag high if the tenant (or guarantor) is personally liable beyond the
  lease term or security deposit amount.
- Rent escalation: flag medium+ if rent can increase without a cap, formula, or advance
  notice requirement.
- Early termination: flag medium+ if termination fees are undefined, uncapped, or
  disproportionate to remaining rent.
- Maintenance responsibilities: flag medium if obligations are vague or one-sided
  (e.g. tenant responsible for structural or HVAC repairs).
- Subletting/assignment: flag medium if subletting is prohibited outright or requires
  landlord approval at sole discretion.
- Security deposit: flag medium if return conditions, permissible deductions, or return
  timeline are unspecified.
- Automatic renewal: flag medium+ if the lease auto-renews without an adequate tenant
  notice window to opt out.
- Use restrictions: flag medium if permitted use is narrow and violations trigger
  immediate termination rights.
""".strip()

SAAS_RUBRIC_ADDENDUM = """
SaaS / Terms of Service-specific focus:
- Unilateral changes: flag high if the provider can change pricing, features, or terms
  without notice or without requiring customer consent.
- Auto-renewal: flag medium+ if the subscription auto-renews without a clear notice period
  or cancellation window before the renewal date.
- IP and data ownership: flag high if the customer's data or content is assigned to the
  provider, or if the provider's usage rights over customer data are overly broad.
- Data retention post-termination: flag medium+ if customer data is retained indefinitely
  or deletion timelines are unspecified after contract end.
- Limitation of liability: flag medium+ if the provider's liability is capped so low it
  offers no meaningful remedy (e.g. capped at one month's fees for data loss).
- Indemnification: flag high if the customer must indemnify the provider for broad or
  undefined third-party claims.
- SLA / uptime: flag medium if no SLA is defined or if remedies for downtime are absent.
- Termination for convenience: flag medium if the provider can terminate with short or no
  notice and offers no pro-rata refund of prepaid fees.
""".strip()

PRIVACY_RUBRIC_ADDENDUM = """
Privacy policy-specific focus:
- Third-party data sharing: flag high if data is shared with undefined "third parties" or
  "partners" without specifying who they are or for what purpose.
- Data retention: flag high if data is retained indefinitely or no specific retention
  period is stated.
- Right to deletion: flag medium+ if users have no stated right to request deletion or
  erasure of their personal data.
- Opt-out mechanisms: flag medium if users cannot opt out of data collection, sharing,
  or marketing communications.
- Cross-border transfers: flag medium+ if data is transferred internationally without
  specifying safeguards (e.g. Standard Contractual Clauses, adequacy decisions).
- Children's data: flag high if the policy does not address or explicitly prohibit
  collection of data from minors.
- Cookie consent: flag medium if cookie usage is broad, uncategorized, or consent
  mechanisms are vague or pre-checked.
- Policy changes: flag medium+ if the policy can be updated without notifying users
  or obtaining renewed consent.
""".strip()


def build_rubric(document_kind: str) -> str:
    addenda: dict[str, str] = {
        "employment": EMPLOYMENT_RUBRIC_ADDENDUM,
        "nda": NDA_RUBRIC_ADDENDUM,
        "lease": LEASE_RUBRIC_ADDENDUM,
        "saas_terms": SAAS_RUBRIC_ADDENDUM,
        "privacy": PRIVACY_RUBRIC_ADDENDUM,
    }
    addendum = addenda.get(document_kind)
    if addendum:
        return f"{UNIVERSAL_RUBRIC}\n\n{addendum}"
    return UNIVERSAL_RUBRIC
