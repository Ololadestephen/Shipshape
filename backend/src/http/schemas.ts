import { z } from "zod";

const publicUrlSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed && !/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed;
  },
  z.string().trim().url()
);

export const appTypeSchema = z.enum(["saas", "ecommerce", "portfolio", "internal_tool", "marketplace", "content", "other"]);
export const projectStatusSchema = z.enum(["draft", "testing", "blocked", "ready_with_warnings", "ready"]);
export const flowPrioritySchema = z.enum(["critical", "important", "nice_to_have"]);
export const severitySchema = z.enum(["blocker", "warning", "polish"]);
export const checkStatusSchema = z.enum(["untested", "failed", "fixing", "verified"]);
export const issueStatusSchema = z.enum(["open", "fixing", "verified", "wont_fix"]);
export const runSourceSchema = z.enum(["manual", "testsprite", "ci"]);
export const runStatusSchema = z.enum(["passed", "failed", "partial"]);
export const resultStatusSchema = z.enum(["passed", "failed", "skipped"]);
export const loopKindSchema = z.enum(["failure", "fix", "verification", "note"]);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  url: publicUrlSchema,
  appType: appTypeSchema,
  flows: z.array(z.string().trim().min(1)).optional()
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).optional(),
  url: publicUrlSchema.optional(),
  appType: appTypeSchema.optional(),
  status: projectStatusSchema.optional(),
  testspriteProjectId: z.string().trim().optional(),
  testspriteProjectUrl: publicUrlSchema.optional()
});

export const createTestSpriteProjectSchema = z.object({
  targetUrl: publicUrlSchema.optional()
});

export const createFlowSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  priority: flowPrioritySchema.optional()
});

export const updateFlowSchema = createFlowSchema.partial();

export const generateChecklistSchema = z.object({
  replaceExisting: z.boolean().default(true)
});

export const updateCheckSchema = z.object({
  status: checkStatusSchema.optional(),
  notes: z.string().trim().optional(),
  severity: severitySchema.optional()
});

export const createIssueSchema = z.object({
  checkId: z.string().trim().optional(),
  title: z.string().trim().min(1),
  severity: severitySchema,
  status: issueStatusSchema.optional(),
  reproSteps: z.array(z.string().trim()).optional(),
  expected: z.string().trim().optional(),
  actual: z.string().trim().optional(),
  suggestedFix: z.string().trim().optional(),
  evidenceUrl: z.string().trim().url().optional()
});

export const updateIssueSchema = createIssueSchema.partial();

export const runResultInputSchema = z.object({
  checkId: z.string().trim().optional(),
  status: resultStatusSchema,
  message: z.string().trim().min(1),
  evidenceUrl: z.string().trim().url().optional()
});

export const createRunSchema = z.object({
  source: runSourceSchema,
  status: runStatusSchema,
  summary: z.string().trim().min(1),
  results: z.array(runResultInputSchema).optional()
});

export const createLoopEntrySchema = z.object({
  kind: loopKindSchema,
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  runId: z.string().trim().optional(),
  issueId: z.string().trim().optional(),
  evidenceUrl: z.string().trim().url().optional()
});
