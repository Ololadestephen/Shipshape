import { describe, expect, it } from "vitest";
import { MemoryStore } from "../storage/memoryStore.js";
import { ShipShapeService } from "../services/shipshapeService.js";
import { computeReportDigest } from "../domain/snapshot.js";

function setupService() {
  const store = new MemoryStore();
  const service = new ShipShapeService(store);
  const project = service.createProject({
    name: "DocChain Web",
    url: "https://docchain.ai",
    appType: "saas",
    flows: ["Authentication", "Document Upload"]
  });
  return { store, service, project };
}

describe("Publication Workflow & Registry API", () => {
  it("generates an initial publishable snapshot with version 1 and null predecessor", () => {
    const { service, project } = setupService();

    const result = service.getPublishableSnapshot(project.project.id);
    expect(result.nextVersion).toBe(1);
    expect(result.predecessorDigest).toBeNull();
    expect(result.snapshot.version).toBe(1);
    expect(result.snapshot.targetUrl).toBe("https://docchain.ai");
    expect(result.digest).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.digest).toBe(computeReportDigest(result.snapshot));
  });

  it("records a valid report publication and appends a verification loop entry", () => {
    const { service, project } = setupService();
    const { snapshot, digest } = service.getPublishableSnapshot(project.project.id);

    const txHash = "0x" + "1".repeat(64);
    const publisher = "0x" + "a".repeat(40);
    const contract = "0x" + "c".repeat(40);

    const publication = service.recordPublication(project.project.id, {
      transactionHash: txHash,
      publisher,
      contractAddress: contract,
      chainId: 677,
      reportHash: digest,
      version: 1,
      snapshot
    });

    expect(publication.id).toMatch(/^pub_/);
    expect(publication.version).toBe(1);
    expect(publication.reportHash).toBe(digest.toLowerCase());
    expect(publication.publisher).toBe(publisher.toLowerCase());
    expect(publication.transactionHash).toBe(txHash.toLowerCase());

    // Check publication in project detail
    const detail = service.getProjectDetailOrThrow(project.project.id);
    expect(detail.latestPublication?.reportHash).toBe(digest.toLowerCase());
    expect(detail.publications?.length).toBe(1);

    // Check verification loop entry was recorded
    const loop = service.listLoop(project.project.id);
    const pubEntry = loop.find((entry) => entry.title.includes("published to BOT Chain"));
    expect(pubEntry).toBeDefined();
    expect(pubEntry?.body).toContain(digest);
    expect(pubEntry?.body).toContain(publisher.toLowerCase());
  });

  it("rejects mismatched snapshot digest or spoofed report hash", () => {
    const { service, project } = setupService();
    const { snapshot } = service.getPublishableSnapshot(project.project.id);

    const fakeDigest = "0x" + "f".repeat(64);
    expect(() =>
      service.recordPublication(project.project.id, {
        transactionHash: "0x" + "1".repeat(64),
        publisher: "0x" + "a".repeat(40),
        contractAddress: "0x" + "c".repeat(40),
        chainId: 677,
        reportHash: fakeDigest,
        version: 1,
        snapshot
      })
    ).toThrow(/Computed digest.*does not match/);
  });

  it("rejects duplicate publication submissions for the same report hash", () => {
    const { service, project } = setupService();
    const { snapshot, digest } = service.getPublishableSnapshot(project.project.id);

    service.recordPublication(project.project.id, {
      transactionHash: "0x" + "1".repeat(64),
      publisher: "0x" + "a".repeat(40),
      contractAddress: "0x" + "c".repeat(40),
      chainId: 677,
      reportHash: digest,
      version: 1,
      snapshot
    });

    expect(() =>
      service.recordPublication(project.project.id, {
        transactionHash: "0x" + "2".repeat(64),
        publisher: "0x" + "b".repeat(40),
        contractAddress: "0x" + "c".repeat(40),
        chainId: 677,
        reportHash: digest,
        version: 1,
        snapshot
      })
    ).toThrow(/already been published/);
  });

  it("enforces immutable versions and predecessor linking on subsequent publications", () => {
    const { service, project } = setupService();
    const v1 = service.getPublishableSnapshot(project.project.id);

    service.recordPublication(project.project.id, {
      transactionHash: "0x" + "1".repeat(64),
      publisher: "0x" + "a".repeat(40),
      contractAddress: "0x" + "c".repeat(40),
      chainId: 677,
      reportHash: v1.digest,
      version: 1,
      snapshot: v1.snapshot
    });

    // Next snapshot should automatically require version 2 and predecessor v1.digest
    const v2 = service.getPublishableSnapshot(project.project.id);
    expect(v2.nextVersion).toBe(2);
    expect(v2.predecessorDigest).toBe(v1.digest.toLowerCase());
    expect(v2.snapshot.version).toBe(2);
    expect(v2.snapshot.predecessorDigest).toBe(v1.digest.toLowerCase());

    // Fails if predecessor is missing for version 2
    expect(() =>
      service.recordPublication(project.project.id, {
        transactionHash: "0x" + "2".repeat(64),
        publisher: "0x" + "a".repeat(40),
        contractAddress: "0x" + "c".repeat(40),
        chainId: 677,
        reportHash: v2.digest,
        version: 2,
        predecessorHash: null,
        snapshot: v2.snapshot
      })
    ).toThrow(/Predecessor hash does not match/);

    // Succeeds when predecessor matches
    const pub2 = service.recordPublication(project.project.id, {
      transactionHash: "0x" + "2".repeat(64),
      publisher: "0x" + "a".repeat(40),
      contractAddress: "0x" + "c".repeat(40),
      chainId: 677,
      reportHash: v2.digest,
      version: 2,
      predecessorHash: v1.digest,
      snapshot: v2.snapshot
    });

    expect(pub2.version).toBe(2);
    expect(pub2.predecessorHash).toBe(v1.digest.toLowerCase());
  });

  it("verifies exported report files against recorded receipts and flags tampering", () => {
    const { service, project } = setupService();
    const { snapshot, digest } = service.getPublishableSnapshot(project.project.id);

    service.recordPublication(project.project.id, {
      transactionHash: "0x" + "1".repeat(64),
      publisher: "0x" + "a".repeat(40),
      contractAddress: "0x" + "c".repeat(40),
      chainId: 677,
      reportHash: digest,
      version: 1,
      snapshot
    });

    const exportText = JSON.stringify(snapshot, null, 2);

    // Verify valid export
    const verifyValid = service.verifyReport({
      snapshotOrExport: exportText,
      expectedHash: digest
    });
    expect(verifyValid.valid).toBe(true);
    expect(verifyValid.matchesExpected).toBe(true);
    expect(verifyValid.publication?.reportHash).toBe(digest.toLowerCase());

    // Verify tampered export (someone modified the score or summary)
    const tampered = JSON.parse(exportText) as typeof snapshot;
    tampered.readinessScore = 100;
    const verifyTampered = service.verifyReport({
      snapshotOrExport: JSON.stringify(tampered),
      expectedHash: digest
    });
    expect(verifyTampered.valid).toBe(true);
    expect(verifyTampered.matchesExpected).toBe(false);
    expect(verifyTampered.publication).toBeUndefined();
  });
});
