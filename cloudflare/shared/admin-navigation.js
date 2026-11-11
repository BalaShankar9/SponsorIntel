// Stable owner-only destinations. Unknown fragments safely open the overview.
export const ADMIN_SECTIONS = Object.freeze([
  {id:'overview',label:'Overview',description:'Key numbers and the findings that need your attention.'},
  {id:'jobs',label:'Jobs & reviews',description:'Review discovery leads and advert evidence.'},
  {id:'sources',label:'Sources',description:'Check freshness, review employers and manage source agents.'},
  {id:'marketing',label:'Marketing',description:'Plan content, review it and verify delivery.'},
  {id:'analytics',label:'Analytics & SEO',description:'Understand usage, search visibility and campaign activity.'},
  {id:'people',label:'People & support',description:'Account activity, feedback and support requests.'},
  {id:'operations',label:'Operations',description:'Schedules, alerts, findings and execution receipts.'},
  {id:'quality',label:'AI quality',description:'Private research and application evaluations.'},
]);
export function adminSectionFromHash(hash) {
  // Keep links from existing operational alert emails usable.
  if (hash === '#operation-alerts') return 'operations';
  return ADMIN_SECTIONS.find(item => hash === '#admin-'+item.id)?.id || 'overview';
}
