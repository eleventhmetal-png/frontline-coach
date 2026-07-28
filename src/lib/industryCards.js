// Landing-page industry cards. Kept separate from the INDUSTRIES map in App.jsx
// on purpose: that one holds the AI's `world` prompt, this one holds marketing
// copy. Same eight settings, two different jobs — a prompt that leaked onto a
// landing page would read like machine instructions, and a marketing blurb inside
// a prompt would make the model chatty.
//
// KEEP THE LIST IN SYNC with INDUSTRIES in src/App.jsx. If a setting exists in the
// picker but not here, the landing page under-sells what the product covers.
//
// ── Why situations rather than KPIs ─────────────────────────────────────────
// North's version of this section lists KPIs per industry — RevPAR, sprint
// velocity, shrinkage. That fits a product that reports on metrics. Frontline
// Coach doesn't track a single KPI; it helps with conversations. Chips of metrics
// would promise analytics that don't exist, and they'd bury the actual
// differentiator.
//
// So each card shows the conversations that really happen in that setting, in the
// words a supervisor there would use. It's honest about what the product does, and
// it's the thing no competitor can copy without rebuilding for hourly work.

export const INDUSTRY_CARDS = [
  {
    id: "restaurant",
    label: "Restaurant",
    blurb: "Front of house, back of house, and everyone in the weeds",
    situations: ["Sidework skipped before clocking out", "Server vanishing during the rush", "Line cook snapping at the new host"],
  },
  {
    id: "retail",
    label: "Retail",
    blurb: "Sales floor, stockroom, and the register line",
    situations: ["Zone left unfinished at break", "Associate arguing in front of customers", "Go-backs piling up on one shift"],
  },
  {
    id: "carwash",
    label: "Car Wash",
    blurb: "Tunnel, prep, vac lanes, and membership targets",
    situations: ["Prep skipping steps when it backs up", "Best closer running down the new hires", "Lane left unstaffed at open"],
  },
  {
    id: "warehouse",
    label: "Warehouse",
    blurb: "Receiving, picking, staging, and the dock",
    situations: ["Pick rate sliding without explanation", "PPE 'forgotten' three shifts running", "Zone not cleared before break"],
  },
  {
    id: "hospitality",
    label: "Hospitality",
    blurb: "Front desk, housekeeping, and guest recovery",
    situations: ["Room turns running long every shift", "Agent short with a guest at check-in", "Board not updated before hand-off"],
  },
  {
    id: "healthcare",
    label: "Healthcare",
    blurb: "Clinics, units, and care facilities",
    situations: ["Charting finished late, every shift", "Experienced CNA icing out new hires", "Callouts landing on the same people"],
  },
  {
    id: "fieldservice",
    label: "Field Service",
    blurb: "Techs, dispatch, and the truck",
    situations: ["Job notes never logged", "Tech blowing off dispatch", "Callback rate climbing on one route"],
  },
  {
    id: "general",
    label: "Any frontline team",
    blurb: "Not on the list? The coach mirrors your own words instead of guessing",
    situations: ["Repeated lateness", "Good worker, bad attitude", "A standard quietly slipping"],
  },
];
