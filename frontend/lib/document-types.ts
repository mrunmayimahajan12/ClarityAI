/** Values must match backend `normalize_document_kind` / `ALLOWED_DOCUMENT_KINDS`. */
export const DOCUMENT_TYPES = [
  { id: "employment", label: "Employment / offer", description: "Offer letters, contracts" },
  { id: "nda", label: "NDA", description: "Confidentiality agreements" },
  { id: "lease", label: "Lease", description: "Rental or commercial lease" },
  { id: "saas_terms", label: "Terms of service", description: "SaaS, websites, apps" },
  { id: "privacy", label: "Privacy policy", description: "Data collection & use" },
  { id: "generic", label: "Other / not sure", description: "General document" },
] as const;

export type DocumentTypeId = (typeof DOCUMENT_TYPES)[number]["id"];

export function documentTypeLabel(id: string): string {
  const row = DOCUMENT_TYPES.find((t) => t.id === id);
  return row?.label ?? "Other / not sure";
}
