/** Documents behind every rule. Page numbers are PDF pages. See docs/rules.md. */
export const DOCS = {
  SB4: {
    name: "HCD fact sheet: Faith & Higher Education Lands (SB 4)",
    url: "https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/aff-hsg-faith-higher-ed-sb-4.pdf",
  },
  FS: {
    name: "HCD Housing Law Fact Sheets (Apr 2026)",
    url: "https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/housing-law-fact-sheets.pdf",
  },
  SB9FS: {
    name: "HCD SB 9 Fact Sheet (Sept 2024)",
    url: "https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/sb-9-fact-sheet.pdf",
  },
  SLAG: {
    name: "HCD Surplus Land Act Guidelines (2024)",
    url: "https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/final-updated-surplus-land-act-guidelines-2024.pdf",
  },
  AB2097: {
    name: "HCD AB 2097 Technical Advisory (Jan 2025)",
    url: "https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ab-2097-ta.pdf",
  },
  DD684: {
    name: "CalMatters Digital Democracy: SB 684 (secondary)",
    url: "https://calmatters.digitaldemocracy.org/bills/ca_202320240sb684",
  },
  DD1123: {
    name: "CalMatters Digital Democracy: SB 1123 (secondary)",
    url: "https://calmatters.digitaldemocracy.org/bills/ca_202320240sb1123",
  },
} as const;

export type DocId = keyof typeof DOCS;
export interface Cite {
  doc: DocId;
  page?: string;
  /** Gov Code section if the source gives it */
  section?: string;
  /** e.g. "secondary source" or "unverified" */
  caveat?: string;
}

export const CHECKED = "2026-11-07";
