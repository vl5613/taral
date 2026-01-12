import { describe, it, expect, beforeEach } from "vitest";
import { Cl, ClarityValue } from "@stacks/transactions";

// Test addresses
const deployer = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
const exporter = "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5";
const importer = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";
const thirdParty = "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC";

describe("Taral Escrow Contract Tests", () => {
  // Helper to create a test hash
  const createTestHash = (seed: string): Uint8Array => {
    const hash = new Uint8Array(32);
    for (let i = 0; i < 32 && i < seed.length; i++) {
      hash[i] = seed.charCodeAt(i);
    }
    return hash;
  };

  describe("Escrow Storage Tests", () => {
    it("should create an escrow", async () => {
      const { result } = simnet.callPublicFn(
        "escrow-storage",
        "create-escrow",
        [
          Cl.uint(10001), // order-id
          Cl.standardPrincipal(exporter),
          Cl.standardPrincipal(importer),
          Cl.uint(1000000), // amount
          Cl.uint(300000), // downpayment
          Cl.uint(700000), // balance
        ],
        deployer
      );

      expect(result).toBeOk(Cl.uint(1)); // First escrow ID is 1
    });

    it("should increment escrow nonce", async () => {
      // Create first escrow
      simnet.callPublicFn(
        "escrow-storage",
        "create-escrow",
        [
          Cl.uint(10001),
          Cl.standardPrincipal(exporter),
          Cl.standardPrincipal(importer),
          Cl.uint(1000000),
          Cl.uint(300000),
          Cl.uint(700000),
        ],
        deployer
      );

      simnet.callPublicFn(
        "escrow-storage",
        "increment-escrow-id-nonce",
        [],
        deployer
      );

      // Check nonce
      const { result } = simnet.callReadOnlyFn(
        "escrow-storage",
        "get-escrow-id-nonce",
        [],
        deployer
      );

      expect(result).toBeUint(2);
    });

    it("should get escrow by order ID", async () => {
      // Create escrow
      simnet.callPublicFn(
        "escrow-storage",
        "create-escrow",
        [
          Cl.uint(10002),
          Cl.standardPrincipal(exporter),
          Cl.standardPrincipal(importer),
          Cl.uint(2000000),
          Cl.uint(500000),
          Cl.uint(1500000),
        ],
        deployer
      );

      // Get escrow by order
      const { result } = simnet.callReadOnlyFn(
        "escrow-storage",
        "get-escrow-by-order",
        [Cl.uint(10002)],
        deployer
      );

      // Result should not be none
      expect(result).not.toBeNone();
    });

    it("should mark escrow as funded", async () => {
      // Create escrow first
      simnet.callPublicFn(
        "escrow-storage",
        "create-escrow",
        [
          Cl.uint(10003),
          Cl.standardPrincipal(exporter),
          Cl.standardPrincipal(importer),
          Cl.uint(1000000),
          Cl.uint(300000),
          Cl.uint(700000),
        ],
        deployer
      );

      // Mark as funded
      const { result } = simnet.callPublicFn(
        "escrow-storage",
        "mark-escrow-funded",
        [Cl.uint(1)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify status
      const escrow = simnet.callReadOnlyFn(
        "escrow-storage",
        "get-escrow",
        [Cl.uint(1)],
        deployer
      );

      expect(escrow.result).not.toBeNone();
    });

    it("should mark escrow as shipped", async () => {
      // Create and fund escrow
      simnet.callPublicFn(
        "escrow-storage",
        "create-escrow",
        [
          Cl.uint(10004),
          Cl.standardPrincipal(exporter),
          Cl.standardPrincipal(importer),
          Cl.uint(1000000),
          Cl.uint(300000),
          Cl.uint(700000),
        ],
        deployer
      );

      simnet.callPublicFn(
        "escrow-storage",
        "mark-escrow-funded",
        [Cl.uint(1)],
        deployer
      );

      // Mark as shipped
      const shipmentHash = createTestHash("shipment123");
      const { result } = simnet.callPublicFn(
        "escrow-storage",
        "mark-escrow-shipped",
        [Cl.uint(1), Cl.buffer(shipmentHash)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should add shipment tracking", async () => {
      const trackingHash = createTestHash("tracking456");
      const { result } = simnet.callPublicFn(
        "escrow-storage",
        "add-shipment-tracking",
        [
          Cl.uint(1),
          Cl.stringUtf8("DHL Express"),
          Cl.stringUtf8("1234567890"),
          Cl.uint(100), // estimated delivery block
          Cl.buffer(trackingHash),
        ],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify tracking
      const tracking = simnet.callReadOnlyFn(
        "escrow-storage",
        "get-shipment-tracking",
        [Cl.uint(1)],
        deployer
      );

      expect(tracking.result).not.toBeNone();
    });

    it("should add delivery document", async () => {
      const docHash = createTestHash("document789");
      const { result } = simnet.callPublicFn(
        "escrow-storage",
        "add-delivery-document",
        [
          Cl.uint(1),
          Cl.stringUtf8("bill-of-lading"),
          Cl.buffer(docHash),
          Cl.standardPrincipal(exporter),
        ],
        deployer
      );

      expect(result).toBeOk(Cl.uint(0)); // First document index is 0

      // Verify document count
      const count = simnet.callReadOnlyFn(
        "escrow-storage",
        "get-escrow-doc-count",
        [Cl.uint(1)],
        deployer
      );

      const countTuple = count.result as any;
      expect(countTuple.data.count).toBeUint(1);
    });

    it("should create and resolve dispute", async () => {
      // Create dispute
      const { result: createResult } = simnet.callPublicFn(
        "escrow-storage",
        "create-dispute",
        [
          Cl.uint(1),
          Cl.standardPrincipal(importer),
          Cl.stringUtf8("Goods damaged during shipping"),
        ],
        deployer
      );

      expect(createResult).toBeOk(Cl.bool(true));

      // Resolve dispute
      const { result: resolveResult } = simnet.callPublicFn(
        "escrow-storage",
        "resolve-dispute",
        [
          Cl.uint(1),
          Cl.stringUtf8("Partial refund agreed"),
          Cl.uint(3), // RESOLUTION_PARTIAL
        ],
        deployer
      );

      expect(resolveResult).toBeOk(Cl.bool(true));

      // Verify dispute
      const dispute = simnet.callReadOnlyFn(
        "escrow-storage",
        "get-dispute",
        [Cl.uint(1)],
        deployer
      );

      expect(dispute.result).not.toBeNone();
    });

    it("should check auto-release status", async () => {
      // Create escrow
      simnet.callPublicFn(
        "escrow-storage",
        "create-escrow",
        [
          Cl.uint(10005),
          Cl.standardPrincipal(exporter),
          Cl.standardPrincipal(importer),
          Cl.uint(1000000),
          Cl.uint(300000),
          Cl.uint(700000),
        ],
        deployer
      );

      // Not auto-releasable yet (not shipped)
      const { result } = simnet.callReadOnlyFn(
        "escrow-storage",
        "is-auto-releasable",
        [Cl.uint(1)],
        deployer
      );

      expect(result).toBeBool(false);
    });
  });

  describe("Escrow Status Transitions", () => {
    it("should transition through status states correctly", async () => {
      // Create escrow (PENDING)
      simnet.callPublicFn(
        "escrow-storage",
        "create-escrow",
        [
          Cl.uint(10006),
          Cl.standardPrincipal(exporter),
          Cl.standardPrincipal(importer),
          Cl.uint(1000000),
          Cl.uint(300000),
          Cl.uint(700000),
        ],
        deployer
      );

      // Mark funded (FUNDED)
      simnet.callPublicFn(
        "escrow-storage",
        "mark-escrow-funded",
        [Cl.uint(1)],
        deployer
      );

      // Mark shipped (SHIPPED)
      const shipmentHash = createTestHash("ship");
      simnet.callPublicFn(
        "escrow-storage",
        "mark-escrow-shipped",
        [Cl.uint(1), Cl.buffer(shipmentHash)],
        deployer
      );

      // Mark delivered (DELIVERED)
      const deliveryHash = createTestHash("deliver");
      simnet.callPublicFn(
        "escrow-storage",
        "mark-escrow-delivered",
        [Cl.uint(1), Cl.buffer(deliveryHash)],
        deployer
      );

      // Mark released (RELEASED)
      const { result } = simnet.callPublicFn(
        "escrow-storage",
        "mark-escrow-released",
        [Cl.uint(1)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should handle dispute status", async () => {
      // Create escrow
      simnet.callPublicFn(
        "escrow-storage",
        "create-escrow",
        [
          Cl.uint(10007),
          Cl.standardPrincipal(exporter),
          Cl.standardPrincipal(importer),
          Cl.uint(1000000),
          Cl.uint(300000),
          Cl.uint(700000),
        ],
        deployer
      );

      // Mark disputed
      const { result } = simnet.callPublicFn(
        "escrow-storage",
        "mark-escrow-disputed",
        [Cl.uint(1)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should handle refund status", async () => {
      // Create escrow
      simnet.callPublicFn(
        "escrow-storage",
        "create-escrow",
        [
          Cl.uint(10008),
          Cl.standardPrincipal(exporter),
          Cl.standardPrincipal(importer),
          Cl.uint(1000000),
          Cl.uint(300000),
          Cl.uint(700000),
        ],
        deployer
      );

      // Mark refunded
      const { result } = simnet.callPublicFn(
        "escrow-storage",
        "mark-escrow-refunded",
        [Cl.uint(1)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });
  });

  describe("Document Management", () => {
    it("should verify delivery document", async () => {
      // Create escrow first
      simnet.callPublicFn(
        "escrow-storage",
        "create-escrow",
        [
          Cl.uint(10009),
          Cl.standardPrincipal(exporter),
          Cl.standardPrincipal(importer),
          Cl.uint(1000000),
          Cl.uint(300000),
          Cl.uint(700000),
        ],
        deployer
      );

      // Add document
      const docHash = createTestHash("doc");
      simnet.callPublicFn(
        "escrow-storage",
        "add-delivery-document",
        [
          Cl.uint(1),
          Cl.stringUtf8("customs-declaration"),
          Cl.buffer(docHash),
          Cl.standardPrincipal(exporter),
        ],
        deployer
      );

      // Verify document
      const { result } = simnet.callPublicFn(
        "escrow-storage",
        "verify-delivery-document",
        [Cl.uint(1), Cl.uint(0)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      // Check document is verified
      const doc = simnet.callReadOnlyFn(
        "escrow-storage",
        "get-delivery-document",
        [Cl.uint(1), Cl.uint(0)],
        deployer
      );

      expect(doc.result).not.toBeNone();
    });

    it("should track multiple documents per escrow", async () => {
      // Create escrow
      simnet.callPublicFn(
        "escrow-storage",
        "create-escrow",
        [
          Cl.uint(10010),
          Cl.standardPrincipal(exporter),
          Cl.standardPrincipal(importer),
          Cl.uint(1000000),
          Cl.uint(300000),
          Cl.uint(700000),
        ],
        deployer
      );

      // Add multiple documents
      const docTypes = ["bill-of-lading", "customs-form", "delivery-receipt"];
      for (let i = 0; i < docTypes.length; i++) {
        const docHash = createTestHash(`doc${i}`);
        simnet.callPublicFn(
          "escrow-storage",
          "add-delivery-document",
          [
            Cl.uint(1),
            Cl.stringUtf8(docTypes[i]),
            Cl.buffer(docHash),
            Cl.standardPrincipal(exporter),
          ],
          deployer
        );
      }

      // Check document count
      const count = simnet.callReadOnlyFn(
        "escrow-storage",
        "get-escrow-doc-count",
        [Cl.uint(1)],
        deployer
      );

      const countTuple = count.result as any;
      expect(countTuple.data.count).toBeUint(3);
    });
  });

  describe("Auto-Release Configuration", () => {
    it("should allow setting auto-release blocks", async () => {
      const { result } = simnet.callPublicFn(
        "escrow-storage",
        "set-auto-release-blocks",
        [Cl.uint(4032)], // ~28 days
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify setting
      const blocks = simnet.callReadOnlyFn(
        "escrow-storage",
        "get-auto-release-blocks",
        [],
        deployer
      );

      expect(blocks.result).toBeUint(4032);
    });
  });
});
