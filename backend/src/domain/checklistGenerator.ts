import type { AppType, Check, CheckCategory, Flow, Severity } from "../types/domain.js";
import { createId, nowIso } from "../services/id.js";

interface CheckTemplate {
  category: CheckCategory;
  title: string;
  description: string;
  severity: Severity;
}

const universalTemplates: CheckTemplate[] = [
  {
    category: "navigation",
    title: "Navigation",
    description: "Top-level navigation and CTAs should reach the key launch flows without dead ends.",
    severity: "blocker"
  },
  {
    category: "mobile",
    title: "Mobile",
    description: "The app should be usable on narrow screens without overlapping content or hidden controls.",
    severity: "blocker"
  },
  {
    category: "forms",
    title: "Forms",
    description: "Required fields, invalid inputs, and submission failures should produce actionable feedback.",
    severity: "blocker"
  },
  {
    category: "accessibility",
    title: "Accessibility",
    description: "Buttons, inputs, and navigation controls should be understandable to assistive technology.",
    severity: "warning"
  },
  {
    category: "error_states",
    title: "Error states",
    description: "Users should never land on a blank or silent failure state during a launch-critical flow.",
    severity: "warning"
  },
  {
    category: "ci_cd",
    title: "CI gate",
    description: "The launch should have a CI or TestSprite status that makes regressions visible.",
    severity: "warning"
  }
];

const appTypeTemplates: Record<AppType, CheckTemplate[]> = {
  saas: [
    {
      category: "auth",
      title: "Signup",
      description: "A new user can create an account or enter the product path without getting stuck.",
      severity: "blocker"
    },
    {
      category: "onboarding",
      title: "Onboarding",
      description: "The first-run experience should make the next action obvious after signup.",
      severity: "warning"
    },
    {
      category: "security",
      title: "Security",
      description: "Settings and account routes should not leak protected states.",
      severity: "blocker"
    }
  ],
  ecommerce: [
    {
      category: "forms",
      title: "Checkout",
      description: "Items, quantities, and pricing should remain stable as users move toward purchase.",
      severity: "blocker"
    },
    {
      category: "content",
      title: "Product pages",
      description: "Each product detail route should expose enough information for purchase decisions.",
      severity: "warning"
    }
  ],
  portfolio: [
    {
      category: "forms",
      title: "Contact",
      description: "Visitors should be able to contact the owner through a working form or visible fallback.",
      severity: "blocker"
    },
    {
      category: "seo",
      title: "Metadata",
      description: "Title, description, and social preview metadata should describe the project clearly.",
      severity: "polish"
    }
  ],
  internal_tool: [
    {
      category: "navigation",
      title: "Tables",
      description: "Operators should be able to inspect, filter, and return without losing task context.",
      severity: "warning"
    },
    {
      category: "security",
      title: "Access rules",
      description: "Restricted actions should be hidden or clearly denied with a useful message.",
      severity: "blocker"
    }
  ],
  marketplace: [
    {
      category: "forms",
      title: "Search",
      description: "Search, filters, and sort controls should not break listing discovery.",
      severity: "blocker"
    },
    {
      category: "content",
      title: "Trust signals",
      description: "Listings should show enough context for users to evaluate risk before contacting or buying.",
      severity: "warning"
    }
  ],
  content: [
    {
      category: "content",
      title: "Content routes",
      description: "Articles, media, and category pages should not show broken images or empty embeds.",
      severity: "blocker"
    },
    {
      category: "seo",
      title: "SEO metadata",
      description: "Public content should be legible to search engines and social previews.",
      severity: "warning"
    }
  ],
  other: [
    {
      category: "content",
      title: "First viewport",
      description: "A new visitor should understand what the app does without hunting through the page.",
      severity: "warning"
    }
  ]
};

export function generateChecks(projectId: string, appType: AppType, flows: Flow[]): Check[] {
  const templates = [...universalTemplates, ...appTypeTemplates[appType]];
  const flowTemplates = flows.flatMap((flow) => templatesForFlow(flow));
  const now = nowIso();

  return [...templates, ...flowTemplates].map((template) => ({
    id: createId("chk"),
    projectId,
    flowId: hasFlowId(template) ? template.flowId : undefined,
    category: template.category,
    title: template.title,
    description: template.description,
    severity: template.severity,
    status: "untested",
    createdAt: now,
    updatedAt: now
  }));
}

function hasFlowId(template: CheckTemplate | (CheckTemplate & { flowId: string })): template is CheckTemplate & { flowId: string } {
  return "flowId" in template;
}

function templatesForFlow(flow: Flow): Array<CheckTemplate & { flowId: string }>;
function templatesForFlow(flow: Flow): Array<CheckTemplate & { flowId: string }> {
  const normalized = flow.name.toLowerCase();
  const criticality: Severity = flow.priority === "critical" ? "blocker" : "warning";

  if (normalized.includes("signup") || normalized.includes("login") || normalized.includes("auth")) {
    return [
      {
        flowId: flow.id,
        category: "auth",
        title: flow.name,
        description: "Authentication flows should validate input, recover from failures, and land users in the right place.",
        severity: criticality
      }
    ];
  }

  if (normalized.includes("checkout") || normalized.includes("payment") || normalized.includes("billing")) {
    return [
      {
        flowId: flow.id,
        category: "forms",
        title: flow.name,
        description: "Commercial flows should preserve selected options and communicate submission outcomes.",
        severity: criticality
      }
    ];
  }

  if (normalized.includes("contact") || normalized.includes("form")) {
    return [
      {
        flowId: flow.id,
        category: "forms",
        title: flow.name,
        description: "Contact and lead capture forms should validate input and provide a clear success state.",
        severity: criticality
      }
    ];
  }

  return [
    {
      flowId: flow.id,
      category: "navigation",
      title: flow.name,
      description: "The flow should be discoverable, completable, and recoverable from a new browser session.",
      severity: criticality
    }
  ];
}
