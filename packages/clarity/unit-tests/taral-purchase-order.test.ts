import { Cl, ClarityValue } from "@stacks/transactions";
import { expect, it, describe } from "vitest";
import { describeConditional } from "./describe.skip";
import { RUN_TARAL_PURCHASE_ORDER_TESTS } from "./constants";

const accounts = simnet.getAccounts();
const EXPORTER_WALLET = accounts.get("wallet_8")!;
const EXPORTER_2_WALLET = accounts.get("wallet_9")!;
const IMPORTER_WALLET = accounts.get("wallet_7")!;
const WALLET_1 = accounts.get("wallet_1")!;
const WALLET_2 = accounts.get("wallet_2")!;
const DEPLOYER = accounts.get("deployer")!;

// Helper to create a test order hash
const createTestHash = (data: string): ClarityValue => {
  const hash = new Uint8Array(32);
  for (let i = 0; i < Math.min(data.length, 32); i++) {
    hash[i] = data.charCodeAt(i);
  }
  return Cl.buffer(hash);
};

// Helper to setup exporter and importer for testing
const setupExporterAndImporter = () => {
  // Register exporter
  simnet.callPublicFn(
    "exporter-storage",
    "add-exporter",
    [Cl.standardPrincipal(EXPORTER_WALLET), Cl.uint(1)],
    DEPLOYER,
  );
  simnet.callPublicFn(
    "exporter-storage",
    "add-exporter-profile",
    [
      Cl.uint(1),
      Cl.stringUtf8("Test Exporter"),
      createTestHash("exporter-hash"),
      Cl.stringUtf8("Merchant"),
    ],
    DEPLOYER,
  );

  // Register importer
  simnet.callPublicFn(
    "importer-storage",
    "add-importer",
    [Cl.standardPrincipal(IMPORTER_WALLET), Cl.uint(1)],
    DEPLOYER,
  );
  simnet.callPublicFn(
    "importer-storage",
    "add-importer-profile",
    [
      Cl.uint(1),
      Cl.stringUtf8("Test Importer"),
      createTestHash("importer-hash"),
      Cl.stringUtf8("Buyer"),
    ],
    DEPLOYER,
  );
};

const describeOrSkip = describeConditional(RUN_TARAL_PURCHASE_ORDER_TESTS);

describeOrSkip("Should test taral purchase order flows", () => {
  it("Should check if a user holds TAL tokens", () => {
    const mintTalResult = simnet.callPublicFn(
      "taral-coin",
      "mint",
      [Cl.standardPrincipal(EXPORTER_WALLET), Cl.uint(10)],
      DEPLOYER,
    );

    expect(mintTalResult.result).toBeOk(Cl.bool(true));

    const ftMintEvent = mintTalResult.events[0].data as any;

    expect(ftMintEvent.recipient, `${EXPORTER_WALLET}`);
    expect(ftMintEvent.asset_identifier, `${DEPLOYER}.taral-coin::taral-coin`);
    expect(ftMintEvent.amount, 10 as any);

    let checkIfUserHoldsTalToken = simnet.callPublicFn(
      "taral-purchase-order",
      "check-if-user-holds-tal-token",
      [Cl.standardPrincipal(EXPORTER_WALLET)],
      DEPLOYER,
    );

    expect(checkIfUserHoldsTalToken.result).toBeOk(Cl.bool(true));

    checkIfUserHoldsTalToken = simnet.callPublicFn(
      "taral-purchase-order",
      "check-if-user-holds-tal-token",
      [Cl.standardPrincipal(EXPORTER_2_WALLET)],
      DEPLOYER,
    );

    expect(checkIfUserHoldsTalToken.result).toBeOk(Cl.bool(false));
  }),
    it("Should ensure one is able to create a vault with sufficient collateral", () => {
      const createVaultResult = simnet.callPublicFn(
        "taral-purchase-order",
        "create-vault",
        [Cl.uint(600), Cl.uint(2500000), Cl.uint(400), Cl.uint(30)],
        WALLET_1,
      );

      expect(createVaultResult.result).toBeOk(Cl.uint(1));
    }),
    it("Should ensure one is not able to create a vault with an invalid loan amount", () => {
      const createVaultResult = simnet.callPublicFn(
        "taral-purchase-order",
        "create-vault",
        [Cl.uint(500), Cl.uint(2500000), Cl.uint(0), Cl.uint(30)],
        WALLET_1,
      );

      expect(createVaultResult.result).toBeErr(Cl.uint(404));
    }),
    it("Should ensure one is not able to create a vault with an invalid duration", () => {
      const createVaultResult = simnet.callPublicFn(
        "taral-purchase-order",
        "create-vault",
        [Cl.uint(500), Cl.uint(2500000), Cl.uint(400), Cl.uint(100)],
        WALLET_1,
      );

      expect(createVaultResult.result).toBeErr(Cl.uint(405));
    }),
    // TODO(Doru): check the validity of this test, not sure we test this properly
    it("Should ensure one is not able to liquidate an overcollateralized vault with", () => {
      const createVaultResult = simnet.callPublicFn(
        "taral-purchase-order",
        "create-vault",
        [Cl.uint(500), Cl.uint(2500000), Cl.uint(400), Cl.uint(30)],
        WALLET_1,
      );

      expect(createVaultResult.result).toBeOk(Cl.uint(1));

      const liquidateResult = simnet.callPublicFn(
        "taral-purchase-order",
        "liquidate",
        [Cl.uint(1)],
        WALLET_2,
      );

      expect(liquidateResult.result).toBeErr(Cl.uint(406));
    });
});

// Tests for order signing and payment terms
describeOrSkip("Should test order signing workflow", () => {
  it("Should allow exporter to sign a purchase order", () => {
    setupExporterAndImporter();

    // Initialize a purchase order first
    const initResult = simnet.callPublicFn(
      "taral-purchase-order",
      "initialize",
      [
        Cl.standardPrincipal(EXPORTER_WALLET),
        Cl.standardPrincipal(IMPORTER_WALLET),
        createTestHash("order-hash-123"),
        createTestHash("order-detail-hash"),
        Cl.stringUtf8("30 Days Net"),
        Cl.uint(10000),
        Cl.stringUtf8("FOB"),
      ],
      DEPLOYER,
    );

    expect(initResult.result).toBeOk(Cl.bool(true));

    // Check initial status
    const statusBefore = simnet.callReadOnlyFn(
      "taral-purchase-order",
      "get-order-status",
      [Cl.uint(10001)],
      DEPLOYER,
    );
    expect(statusBefore.result).not.toBeNone();

    // Exporter signs the order
    const signResult = simnet.callPublicFn(
      "taral-purchase-order",
      "sign-as-exporter",
      [Cl.uint(10001)],
      EXPORTER_WALLET,
    );

    expect(signResult.result).toBeOk(Cl.uint(1)); // STATUS_EXPORTER_SIGNED = 1
  });

  it("Should allow importer to sign a purchase order", () => {
    setupExporterAndImporter();

    // Initialize a purchase order
    simnet.callPublicFn(
      "taral-purchase-order",
      "initialize",
      [
        Cl.standardPrincipal(EXPORTER_WALLET),
        Cl.standardPrincipal(IMPORTER_WALLET),
        createTestHash("order-hash-456"),
        createTestHash("order-detail-hash"),
        Cl.stringUtf8("60 Days Net"),
        Cl.uint(20000),
        Cl.stringUtf8("CIF"),
      ],
      DEPLOYER,
    );

    // Importer signs the order
    const signResult = simnet.callPublicFn(
      "taral-purchase-order",
      "sign-as-importer",
      [Cl.uint(10001)],
      IMPORTER_WALLET,
    );

    expect(signResult.result).toBeOk(Cl.uint(2)); // STATUS_IMPORTER_SIGNED = 2
  });

  it("Should set status to BOTH_SIGNED when both parties sign", () => {
    setupExporterAndImporter();

    // Initialize a purchase order
    simnet.callPublicFn(
      "taral-purchase-order",
      "initialize",
      [
        Cl.standardPrincipal(EXPORTER_WALLET),
        Cl.standardPrincipal(IMPORTER_WALLET),
        createTestHash("order-hash-789"),
        createTestHash("order-detail-hash"),
        Cl.stringUtf8("90 Days Net"),
        Cl.uint(30000),
        Cl.stringUtf8("CFR"),
      ],
      DEPLOYER,
    );

    // Exporter signs first
    simnet.callPublicFn(
      "taral-purchase-order",
      "sign-as-exporter",
      [Cl.uint(10001)],
      EXPORTER_WALLET,
    );

    // Importer signs second
    const signResult = simnet.callPublicFn(
      "taral-purchase-order",
      "sign-as-importer",
      [Cl.uint(10001)],
      IMPORTER_WALLET,
    );

    expect(signResult.result).toBeOk(Cl.uint(3)); // STATUS_BOTH_SIGNED = 3
  });

  it("Should prevent unauthorized user from signing", () => {
    setupExporterAndImporter();

    // Initialize a purchase order
    simnet.callPublicFn(
      "taral-purchase-order",
      "initialize",
      [
        Cl.standardPrincipal(EXPORTER_WALLET),
        Cl.standardPrincipal(IMPORTER_WALLET),
        createTestHash("order-hash-unauth"),
        createTestHash("order-detail-hash"),
        Cl.stringUtf8("30 Days Net"),
        Cl.uint(10000),
        Cl.stringUtf8("FOB"),
      ],
      DEPLOYER,
    );

    // Unauthorized user tries to sign as exporter
    const signResult = simnet.callPublicFn(
      "taral-purchase-order",
      "sign-as-exporter",
      [Cl.uint(10001)],
      WALLET_1, // Not the exporter
    );

    expect(signResult.result).toBeErr(Cl.uint(302)); // ERR_NOT_AUTHORIZED
  });

  it("Should prevent double signing by same party", () => {
    setupExporterAndImporter();

    // Initialize a purchase order
    simnet.callPublicFn(
      "taral-purchase-order",
      "initialize",
      [
        Cl.standardPrincipal(EXPORTER_WALLET),
        Cl.standardPrincipal(IMPORTER_WALLET),
        createTestHash("order-hash-double"),
        createTestHash("order-detail-hash"),
        Cl.stringUtf8("30 Days Net"),
        Cl.uint(10000),
        Cl.stringUtf8("FOB"),
      ],
      DEPLOYER,
    );

    // Exporter signs
    simnet.callPublicFn(
      "taral-purchase-order",
      "sign-as-exporter",
      [Cl.uint(10001)],
      EXPORTER_WALLET,
    );

    // Exporter tries to sign again
    const doubleSignResult = simnet.callPublicFn(
      "taral-purchase-order",
      "sign-as-exporter",
      [Cl.uint(10001)],
      EXPORTER_WALLET,
    );

    expect(doubleSignResult.result).toBeErr(Cl.uint(303)); // ERR_ALREADY_SIGNED
  });
});

describeOrSkip("Should test order rejection workflow", () => {
  it("Should allow exporter to reject an order", () => {
    setupExporterAndImporter();

    // Initialize a purchase order
    simnet.callPublicFn(
      "taral-purchase-order",
      "initialize",
      [
        Cl.standardPrincipal(EXPORTER_WALLET),
        Cl.standardPrincipal(IMPORTER_WALLET),
        createTestHash("order-reject-test"),
        createTestHash("order-detail-hash"),
        Cl.stringUtf8("30 Days Net"),
        Cl.uint(10000),
        Cl.stringUtf8("FOB"),
      ],
      DEPLOYER,
    );

    // Exporter rejects the order
    const rejectResult = simnet.callPublicFn(
      "taral-purchase-order",
      "reject-order",
      [Cl.uint(10001), Cl.stringUtf8("Price too low")],
      EXPORTER_WALLET,
    );

    expect(rejectResult.result).toBeOk(Cl.bool(true));
  });

  it("Should prevent signing after rejection", () => {
    setupExporterAndImporter();

    // Initialize a purchase order
    simnet.callPublicFn(
      "taral-purchase-order",
      "initialize",
      [
        Cl.standardPrincipal(EXPORTER_WALLET),
        Cl.standardPrincipal(IMPORTER_WALLET),
        createTestHash("order-reject-sign"),
        createTestHash("order-detail-hash"),
        Cl.stringUtf8("30 Days Net"),
        Cl.uint(10000),
        Cl.stringUtf8("FOB"),
      ],
      DEPLOYER,
    );

    // Exporter rejects the order
    simnet.callPublicFn(
      "taral-purchase-order",
      "reject-order",
      [Cl.uint(10001), Cl.stringUtf8("Terms not acceptable")],
      EXPORTER_WALLET,
    );

    // Importer tries to sign rejected order
    const signResult = simnet.callPublicFn(
      "taral-purchase-order",
      "sign-as-importer",
      [Cl.uint(10001)],
      IMPORTER_WALLET,
    );

    expect(signResult.result).toBeErr(Cl.uint(304)); // ERR_ORDER_REJECTED
  });
});

describeOrSkip("Should test payment terms workflow", () => {
  it("Should allow submitting payment terms for an order", () => {
    setupExporterAndImporter();

    // Initialize a purchase order
    simnet.callPublicFn(
      "taral-purchase-order",
      "initialize",
      [
        Cl.standardPrincipal(EXPORTER_WALLET),
        Cl.standardPrincipal(IMPORTER_WALLET),
        createTestHash("order-terms-test"),
        createTestHash("order-detail-hash"),
        Cl.stringUtf8("30 Days Net"),
        Cl.uint(10000),
        Cl.stringUtf8("FOB"),
      ],
      DEPLOYER,
    );

    // Submit payment terms
    const termsResult = simnet.callPublicFn(
      "taral-purchase-order",
      "submit-payment-terms",
      [
        Cl.uint(10001),
        createTestHash("terms-hash-123"),
        Cl.uint(2000), // downpayment
        Cl.uint(8000), // balance
        Cl.uint(30), // duration
        Cl.uint(500), // 5% interest rate
      ],
      EXPORTER_WALLET,
    );

    expect(termsResult.result).toBeOk(Cl.bool(true));
  });

  it("Should allow counterparty to approve payment terms", () => {
    setupExporterAndImporter();

    // Initialize a purchase order
    simnet.callPublicFn(
      "taral-purchase-order",
      "initialize",
      [
        Cl.standardPrincipal(EXPORTER_WALLET),
        Cl.standardPrincipal(IMPORTER_WALLET),
        createTestHash("order-approve-terms"),
        createTestHash("order-detail-hash"),
        Cl.stringUtf8("30 Days Net"),
        Cl.uint(10000),
        Cl.stringUtf8("FOB"),
      ],
      DEPLOYER,
    );

    // Exporter submits payment terms
    simnet.callPublicFn(
      "taral-purchase-order",
      "submit-payment-terms",
      [
        Cl.uint(10001),
        createTestHash("terms-hash-456"),
        Cl.uint(3000),
        Cl.uint(7000),
        Cl.uint(60),
        Cl.uint(750),
      ],
      EXPORTER_WALLET,
    );

    // Importer approves terms
    const approveResult = simnet.callPublicFn(
      "taral-purchase-order",
      "approve-payment-terms",
      [Cl.uint(10001)],
      IMPORTER_WALLET,
    );

    expect(approveResult.result).toBeOk(Cl.bool(true));
  });

  it("Should prevent submitter from approving their own terms", () => {
    setupExporterAndImporter();

    // Initialize a purchase order
    simnet.callPublicFn(
      "taral-purchase-order",
      "initialize",
      [
        Cl.standardPrincipal(EXPORTER_WALLET),
        Cl.standardPrincipal(IMPORTER_WALLET),
        createTestHash("order-self-approve"),
        createTestHash("order-detail-hash"),
        Cl.stringUtf8("30 Days Net"),
        Cl.uint(10000),
        Cl.stringUtf8("FOB"),
      ],
      DEPLOYER,
    );

    // Exporter submits payment terms
    simnet.callPublicFn(
      "taral-purchase-order",
      "submit-payment-terms",
      [
        Cl.uint(10001),
        createTestHash("terms-hash-self"),
        Cl.uint(3000),
        Cl.uint(7000),
        Cl.uint(60),
        Cl.uint(750),
      ],
      EXPORTER_WALLET,
    );

    // Exporter tries to approve their own terms
    const approveResult = simnet.callPublicFn(
      "taral-purchase-order",
      "approve-payment-terms",
      [Cl.uint(10001)],
      EXPORTER_WALLET,
    );

    expect(approveResult.result).toBeErr(Cl.uint(302)); // ERR_NOT_AUTHORIZED
  });

  it("Should reject payment terms with invalid duration", () => {
    setupExporterAndImporter();

    // Initialize a purchase order
    simnet.callPublicFn(
      "taral-purchase-order",
      "initialize",
      [
        Cl.standardPrincipal(EXPORTER_WALLET),
        Cl.standardPrincipal(IMPORTER_WALLET),
        createTestHash("order-invalid-dur"),
        createTestHash("order-detail-hash"),
        Cl.stringUtf8("30 Days Net"),
        Cl.uint(10000),
        Cl.stringUtf8("FOB"),
      ],
      DEPLOYER,
    );

    // Try to submit terms with duration > 90 days
    const termsResult = simnet.callPublicFn(
      "taral-purchase-order",
      "submit-payment-terms",
      [
        Cl.uint(10001),
        createTestHash("terms-hash-invalid"),
        Cl.uint(3000),
        Cl.uint(7000),
        Cl.uint(120), // Invalid: > 90 days
        Cl.uint(750),
      ],
      EXPORTER_WALLET,
    );

    expect(termsResult.result).toBeErr(Cl.uint(405)); // ERR_INVALID_LOAN_DURATION
  });
});
