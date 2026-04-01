export type Risk = "high" | "medium" | "low";

export interface Section {
  id: string;
  title: string;
  risk: Risk;
  summary: string;
  whyItMatters: string;
  evidence: string;
  suggestedAction: string;
  /** Source excerpt from API (for previews / grounding) */
  rawText?: string;
  /** Deterministic rule-based signals for this section */
  riskFactors?: string[];
}

export interface AnalysisData {
  documentTitle: string;
  documentKind: string;
  overallRisk: Risk;
  summary: string;
  keyConcerns: string[];
  nextSteps: string[];
  sections: Section[];
}

export const ANALYSIS_DATA: AnalysisData = {
  documentTitle: "Employment Offer Letter",
  documentKind: "employment",
  overallRisk: "medium",
  summary:
    "This employment offer letter is largely standard but contains several clauses that warrant attention. The non-compete clause is broadly written and may restrict future opportunities, while the IP assignment language is unusually broad. Compensation terms are straightforward.",
  keyConcerns: [
    "Non-compete clause covers 18 months across all tech industry roles",
    "IP assignment clause includes work done outside of work hours",
    "At-will termination with no severance provision",
  ],
  nextSteps: [
    "Request clarification or narrowing of the non-compete scope",
    "Negotiate a carve-out for personal projects in the IP assignment clause",
    "Ask for a minimum notice period or severance in termination terms",
    "Confirm start date and equity vesting schedule in writing",
    "Review benefits documentation before signing",
  ],
  sections: [
    {
      id: "s1",
      title: "Compensation & Benefits",
      risk: "low",
      summary:
        "Salary is set at $120,000/year with standard health, dental, and vision benefits. A 401(k) with 4% employer match kicks in after 90 days.",
      whyItMatters: "Ensure the compensation aligns with your expectations and that benefit eligibility dates are clear.",
      evidence:
        '"You will receive an annual base salary of $120,000, payable on a bi-weekly basis, subject to applicable deductions."',
      suggestedAction: "Confirm all benefit start dates and ask for the full benefits guide before signing.",
    },
    {
      id: "s2",
      title: "Non-Compete Agreement",
      risk: "high",
      summary:
        "You agree not to work for any company in the technology sector for 18 months after employment ends, within a 100-mile radius.",
      whyItMatters:
        "An 18-month broad non-compete in tech can severely limit future employment options. Courts vary on enforceability.",
      evidence:
        '"Employee shall not, directly or indirectly, engage in any business or employment in the technology sector for a period of eighteen (18) months following termination."',
      suggestedAction:
        "Negotiate to narrow scope to direct competitors only, reduce duration to 6 months, and define 'technology sector' specifically.",
    },
    {
      id: "s3",
      title: "Intellectual Property Assignment",
      risk: "high",
      summary:
        "All work product created by you, even during personal time, may be claimed as company property if it relates to the company's field of business.",
      whyItMatters:
        "This language could give the company ownership over side projects, open source work, or personal apps you build at home.",
      evidence:
        '"Employee hereby assigns all inventions, developments, and works of authorship, whether created during or outside of working hours, that relate to Company\'s current or anticipated business."',
      suggestedAction:
        "Request a personal project carve-out clause listing existing projects by name that are explicitly excluded.",
    },
    {
      id: "s4",
      title: "At-Will Termination",
      risk: "medium",
      summary:
        "Employment is at-will, meaning either party can terminate at any time. No severance is specified, and only 2 weeks notice is expected.",
      whyItMatters:
        "Without a severance clause, you have no financial protection if laid off. Two weeks notice is below industry standard for senior roles.",
      evidence:
        '"Your employment with Company is at-will, and either party may terminate the relationship at any time, with or without cause, upon two (2) weeks written notice."',
      suggestedAction:
        "Ask for a 4-week notice period and a severance clause of at least 1 month per year of service.",
    },
    {
      id: "s5",
      title: "Equity & Stock Options",
      risk: "medium",
      summary:
        "You are granted 10,000 stock options with a 4-year vesting schedule and a 1-year cliff. Options expire 90 days after termination.",
      whyItMatters:
        "The 90-day exercise window post-termination is short and could force you to pay a large tax bill or lose unvested options.",
      evidence:
        '"Options shall vest over a period of four (4) years, with a one-year cliff. All unexercised options shall expire ninety (90) days after the termination of employment."',
      suggestedAction:
        "Negotiate for an extended post-termination exercise window (ideally 1–5 years) and confirm the current 409A valuation.",
    },
    {
      id: "s6",
      title: "Confidentiality",
      risk: "low",
      summary:
        "Standard NDA terms apply during and after employment. You agree not to disclose proprietary information indefinitely.",
      whyItMatters: "This is standard practice. Ensure it doesn't inadvertently cover public knowledge or your general skills.",
      evidence:
        '"Employee shall not disclose any Confidential Information of the Company to third parties during or after the term of employment."',
      suggestedAction: "Verify the definition of 'Confidential Information' does not include publicly available knowledge or general skills.",
    },
    {
      id: "s7",
      title: "Dispute Resolution",
      risk: "low",
      summary:
        "All disputes are subject to binding arbitration in California under JAMS rules. Class action waiver is included.",
      whyItMatters: "Arbitration limits your ability to sue in court. The class action waiver prevents joining group lawsuits.",
      evidence:
        '"Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration under the JAMS Employment Arbitration Rules."',
      suggestedAction: "This is fairly standard. Review whether California's arbitration laws apply favorable protections to you.",
    },
  ],
};
