import type { NextFunction, Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { ZodError, type ZodTypeAny } from "zod";
import {
  createFlowSchema,
  createIssueSchema,
  createLoopEntrySchema,
  createProjectSchema,
  createRunSchema,
  createTestSpriteProjectSchema,
  generateChecklistSchema,
  runResultInputSchema,
  updateCheckSchema,
  updateFlowSchema,
  updateIssueSchema,
  updateProjectSchema
} from "./schemas.js";
import { HttpError, type ShipShapeService } from "../services/shipshapeService.js";

export function createApiRouter(service: ShipShapeService): Router {
  const router = createRouter();

  router.get("/health", (_request, response) => {
    response.json({
      ok: true,
      service: "shipshape-backend",
      version: "0.1.0"
    });
  });

  router.get("/projects", (_request, response) => {
    response.json({ data: service.listProjects() });
  });

  router.post("/projects", (request, response) => {
    const body = parseBody(createProjectSchema, request);
    response.status(201).json({ data: service.createProject(body) });
  });

  router.get("/projects/:projectId", (request, response) => {
    response.json({ data: service.getProjectDetailOrThrow(request.params.projectId) });
  });

  router.patch("/projects/:projectId", (request, response) => {
    const body = parseBody(updateProjectSchema, request);
    response.json({ data: service.updateProject(request.params.projectId, body) });
  });

  router.delete("/projects/:projectId", (request, response) => {
    response.json({ data: service.deleteProject(request.params.projectId) });
  });

  router.get("/projects/:projectId/flows", (request, response) => {
    response.json({ data: service.listFlows(request.params.projectId) });
  });

  router.post("/projects/:projectId/flows", (request, response) => {
    const body = parseBody(createFlowSchema, request);
    response.status(201).json({ data: service.createFlow(request.params.projectId, body) });
  });

  router.patch("/flows/:flowId", (request, response) => {
    const body = parseBody(updateFlowSchema, request);
    response.json({ data: service.updateFlow(request.params.flowId, body) });
  });

  router.delete("/flows/:flowId", (request, response) => {
    response.json({ data: service.deleteFlow(request.params.flowId) });
  });

  router.post("/projects/:projectId/generate-checklist", (request, response) => {
    const body = parseBody(generateChecklistSchema, request);
    response.json({ data: service.generateChecklist(request.params.projectId, body.replaceExisting) });
  });

  router.get("/projects/:projectId/checks", (request, response) => {
    response.json({ data: service.listChecks(request.params.projectId) });
  });

  router.patch("/checks/:checkId", (request, response) => {
    const body = parseBody(updateCheckSchema, request);
    response.json({ data: service.updateCheck(request.params.checkId, body) });
  });

  router.get("/projects/:projectId/issues", (request, response) => {
    response.json({ data: service.listIssues(request.params.projectId) });
  });

  router.post("/projects/:projectId/issues", (request, response) => {
    const body = parseBody(createIssueSchema, request);
    response.status(201).json({ data: service.createIssue(request.params.projectId, body) });
  });

  router.patch("/issues/:issueId", (request, response) => {
    const body = parseBody(updateIssueSchema, request);
    response.json({ data: service.updateIssue(request.params.issueId, body) });
  });

  router.get("/projects/:projectId/runs", (request, response) => {
    response.json({ data: service.listRuns(request.params.projectId) });
  });

  router.post("/projects/:projectId/runs", (request, response) => {
    const body = parseBody(createRunSchema, request);
    response.status(201).json({ data: service.createRun(request.params.projectId, body) });
  });

  router.post(
    "/projects/:projectId/testsprite/run",
    asyncHandler(async (request, response) => {
      response.status(201).json({ data: await service.runTestSprite(param(request, "projectId")) });
    })
  );

  router.get("/projects/:projectId/testsprite/setup", (request, response) => {
    response.json({ data: service.getTestSpriteSetup(request.params.projectId) });
  });

  router.post(
    "/projects/:projectId/testsprite/project",
    asyncHandler(async (request, response) => {
      const body = parseBody(createTestSpriteProjectSchema, request);
      response.status(201).json({ data: await service.createTestSpriteProject(param(request, "projectId"), body) });
    })
  );

  router.get("/runs/:runId", (request, response) => {
    response.json({ data: service.getRun(request.params.runId) });
  });

  router.post("/runs/:runId/results", (request, response) => {
    const body = parseBody(runResultInputSchema, request);
    response.status(201).json({ data: service.addRunResult(request.params.runId, body) });
  });

  router.get("/projects/:projectId/report", (request, response) => {
    response.json({ data: service.getOrGenerateReport(request.params.projectId) });
  });

  router.post("/projects/:projectId/report/generate", (request, response) => {
    response.status(201).json({ data: service.generateReport(request.params.projectId) });
  });

  router.get("/projects/:projectId/loop", (request, response) => {
    response.json({ data: service.listLoop(request.params.projectId) });
  });

  router.post("/projects/:projectId/loop", (request, response) => {
    const body = parseBody(createLoopEntrySchema, request);
    response.status(201).json({ data: service.createLoopEntry(request.params.projectId, body) });
  });

  router.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        }
      });
      return;
    }

    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          message: "Invalid request body",
          code: "VALIDATION_ERROR",
          details: error.flatten()
        }
      });
      return;
    }

    response.status(500).json({
      error: {
        message: "Unexpected server error",
        code: "INTERNAL_ERROR"
      }
    });
  });

  return router;
}

function parseBody<TSchema extends ZodTypeAny>(schema: TSchema, request: Request) {
  return schema.parse(request.body);
}

function param(request: Request, name: string) {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] : value;
}

function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>
) {
  return (request: Request, response: Response, next: NextFunction) => {
    handler(request, response, next).catch(next);
  };
}
