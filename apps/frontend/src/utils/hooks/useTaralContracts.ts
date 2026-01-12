import {
  useAccount,
  useAuth,
  useNetwork,
  useOpenContractCall,
} from "@micro-stacks/react";

import {
  bufferCV,
  standardPrincipalCV,
  stringUtf8CV,
  uintCV,
} from "micro-stacks/clarity";
import {
  FungibleConditionCode,
  PostConditionMode,
  createAssetInfo,
  makeStandardFungiblePostCondition,
} from "micro-stacks/transactions";

import { fetchReadOnlyFunction } from "micro-stacks/api";

import {
  TARAL_IMPORTER_CONTRACT,
  TARAL_PURCHASE_ORDER_CONTRACT,
  PURCHASE_ORDER_STORAGE_CONTRACT
} from "@utils/lib/constants";
import { utf8ToBytes, hexToBytes } from "micro-stacks/common";

function useTaralContracts() {
  const { isSignedIn } = useAuth();
  const { stxAddress } = useAccount();
  const { openContractCall } = useOpenContractCall();
  const { network } = useNetwork();

  const SUSDT_CONTRACT =
    network.chainId === 1
      ? process.env.NEXT_PUBLIC_SUSDT_CONTRACT || ""
      : network.chainId === 2147483648
      ? process.env.NEXT_PUBLIC_SUSDT_TESTNET_CONTRACT || ""
      : "";

  const TARAL_BANK_CONTRACT =
    network.chainId === 1
      ? process.env.NEXT_PUBLIC_TARAL_BANK_CONTRACT || ""
      : network.chainId === 2147483648
      ? process.env.NEXT_PUBLIC_TARAL_BANK_TESTNET_CONTRACT || ""
      : "";

  async function registerTaralImporterOnChain(
    importerPrincipal: string,
    importerName: string,
    hash: string,
    importerCategory: string
  ) {
    const functionArgs = [
      standardPrincipalCV(importerPrincipal),
      stringUtf8CV(importerName),
      bufferCV(utf8ToBytes(hash)),
      stringUtf8CV(importerCategory),
    ];

    const contractAddress = TARAL_IMPORTER_CONTRACT.split(".")[0];
    const contractName = TARAL_IMPORTER_CONTRACT.split(".")[1];

    if (isSignedIn) {
      await openContractCall({
        contractAddress,
        contractName,
        functionName: "register",
        functionArgs: functionArgs,

        onFinish: async (data: any) => {
          console.log("finished contract call!", data);
        },
        onCancel: () => {
          console.log("popup closed!");
        },
      });
    }
  }

  async function createTaralPurchaseOrder(
    applicationId: string,
    loanAmount: number,
    downPayment: number
  ): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const functionArgs = [
        stringUtf8CV(applicationId),
        uintCV(loanAmount),
        uintCV(downPayment),
      ];

      const contractAddress = TARAL_BANK_CONTRACT.split(".")[0];
      const contractName = TARAL_BANK_CONTRACT.split(".")[1];

      const assetAddress = SUSDT_CONTRACT.split(".")[0];
      const assetContractName = SUSDT_CONTRACT.split(".")[1];
      const fungibleAssetInfo = createAssetInfo(
        assetAddress,
        assetContractName,
        "sUSDT"
      );
      const postConditionCode = FungibleConditionCode.LessEqual;
      const postConditionAmount = downPayment;

      const contractFungiblePostCondition = makeStandardFungiblePostCondition(
        stxAddress!,
        postConditionCode,
        postConditionAmount,
        fungibleAssetInfo
      );

      if (isSignedIn) {
        await openContractCall({
          contractAddress,
          contractName,
          functionName: "create-purchase-order",
          postConditions:
            network.chainId === 1 ? [contractFungiblePostCondition] : [],
          postConditionMode:
            network.chainId === 1
              ? PostConditionMode.Deny
              : PostConditionMode.Allow,
          functionArgs: functionArgs,

          onFinish: async (data: any) => {
            console.log("finished contract call!", data);
            // wait for 3 seconds
            resolve(data);
          },
          onCancel: () => {
            console.log("popup closed!");
            //reject(new Error("user rejected transaction!"));
          },
        });
      }
    });
  }

  async function acceptFinancing(): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const contractAddress = TARAL_BANK_CONTRACT.split(".")[0];
      const contractName = TARAL_BANK_CONTRACT.split(".")[1];

      if (isSignedIn) {
        await openContractCall({
          contractAddress,
          contractName,
          functionName: "accept-financing",
          postConditionMode: PostConditionMode.Allow,
          functionArgs: [],

          onFinish: async (data: any) => {
            console.log("finished contract call!", data);
            resolve(data);
          },
          onCancel: () => {
            console.log("popup closed!");
            //reject(new Error("user rejected transaction!"));
          },
        });
      }
    });
  }
  async function finance(id: string): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const contractAddress = TARAL_BANK_CONTRACT.split(".")[0];
      const contractName = TARAL_BANK_CONTRACT.split(".")[1];
      const functionArgs = [stringUtf8CV(id)];

      if (isSignedIn) {
        await openContractCall({
          contractAddress,
          contractName,
          functionName: "finance",
          postConditionMode: PostConditionMode.Allow,
          functionArgs,

          onFinish: async (data: any) => {
            console.log("finished contract call!", data);
            resolve(data);
          },
          onCancel: () => {
            console.log("popup closed!");
            //reject(new Error("user rejected transaction!"));
          },
        });
      }
    });
  }

  async function checkPurchaseOrderHasActiveFinancing(id: string) {
    try {
      const result: any = await fetchReadOnlyFunction({
        network: network,
        contractAddress: TARAL_BANK_CONTRACT.split(".")[0],
        contractName: TARAL_BANK_CONTRACT.split(".")[1],
        senderAddress: TARAL_BANK_CONTRACT.split(".")[0],
        functionArgs: [stringUtf8CV(id)],
        functionName: "has-active-financing",
      });
      return result;
    } catch (e: any) {
      console.error({ e });
    }
  }

  async function getPurchaseOrderById(id: string) {
    try {
      const result: any = await fetchReadOnlyFunction({
        contractAddress: TARAL_BANK_CONTRACT.split(".")[0],
        contractName: TARAL_BANK_CONTRACT.split(".")[1],
        senderAddress: TARAL_BANK_CONTRACT.split(".")[0],
        functionArgs: [stringUtf8CV(id)],
        functionName: "get-po-details",
      });
      return result;
    } catch (e: any) {
      console.error({ e });
    }
  }

  async function getActivePurchaseOrder() {
    try {
      const result: any = await fetchReadOnlyFunction({
        network: network,
        contractAddress: TARAL_BANK_CONTRACT.split(".")[0],
        contractName: TARAL_BANK_CONTRACT.split(".")[1],
        senderAddress: stxAddress!,
        functionArgs: [],
        functionName: "get-active-po-details",
      });
      console.log("result", result);
      return result;
    } catch (e: any) {
      console.error({ e });
    }
  }

  async function makePayment(amount: number): Promise<any> {
    const contractAddress = TARAL_BANK_CONTRACT.split(".")[0];
    const contractName = TARAL_BANK_CONTRACT.split(".")[1];
    const assetAddress = SUSDT_CONTRACT.split(".")[0];
    const assetContractName = SUSDT_CONTRACT.split(".")[1];
    const fungibleAssetInfo = createAssetInfo(
      assetAddress,
      assetContractName,
      "sUSDT"
    );
    const postConditionCode = FungibleConditionCode.LessEqual;
    const postConditionAmount = amount;

    const contractFungiblePostCondition = makeStandardFungiblePostCondition(
      stxAddress!,
      postConditionCode,
      postConditionAmount,
      fungibleAssetInfo
    );
    return new Promise(async (resolve, reject) => {
      if (isSignedIn) {
        await openContractCall({
          contractAddress,
          contractName,
          functionName: "make-payment",
          postConditions:
            network.chainId === 1 ? [contractFungiblePostCondition] : [],
          postConditionMode:
            network.chainId === 1
              ? PostConditionMode.Deny
              : PostConditionMode.Allow,
          functionArgs: [],

          onFinish: async (data: any) => {
            console.log("finished contract call!", data);

            resolve(data);
          },
          onCancel: () => {
            console.log("popup closed!");
          },
        });
      }
    });
  }

  /**
   * Initialize a purchase order on-chain
   * Calls the taral-purchase-order contract's initialize function
   * @param exporterPrincipal - Principal address of the exporter
   * @param importerPrincipal - Principal address of the importer
   * @param orderHash - SHA256 hash of order data (as hex string)
   * @param orderDetailHash - SHA256 hash of order details (as hex string)
   * @param paymentTerm - Payment terms (e.g., "30 Days", "60 Days")
   * @param amount - Order amount in smallest unit
   * @param deliveryTerm - Delivery term (e.g., "FOB", "CIF")
   */
  async function initializePurchaseOrder(
    exporterPrincipal: string,
    importerPrincipal: string,
    orderHash: string,
    orderDetailHash: string,
    paymentTerm: string,
    amount: number,
    deliveryTerm: string
  ): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const contractAddress = TARAL_PURCHASE_ORDER_CONTRACT.split(".")[0];
      const contractName = TARAL_PURCHASE_ORDER_CONTRACT.split(".")[1];

      // Convert hex strings to buffer CVs
      const orderHashBytes = hexToBytes(orderHash.startsWith("0x") ? orderHash.slice(2) : orderHash);
      const orderDetailHashBytes = hexToBytes(orderDetailHash.startsWith("0x") ? orderDetailHash.slice(2) : orderDetailHash);

      const functionArgs = [
        standardPrincipalCV(exporterPrincipal),
        standardPrincipalCV(importerPrincipal),
        bufferCV(orderHashBytes),
        bufferCV(orderDetailHashBytes),
        stringUtf8CV(paymentTerm),
        uintCV(amount),
        stringUtf8CV(deliveryTerm),
      ];

      if (isSignedIn) {
        await openContractCall({
          contractAddress,
          contractName,
          functionName: "initialize",
          functionArgs: functionArgs,
          postConditionMode: PostConditionMode.Allow,

          onFinish: async (data: any) => {
            console.log("Purchase order initialized on-chain!", data);
            resolve(data);
          },
          onCancel: () => {
            console.log("Purchase order initialization cancelled");
            reject(new Error("User cancelled transaction"));
          },
        });
      } else {
        reject(new Error("User not signed in"));
      }
    });
  }

  /**
   * Get purchase order details from storage contract
   * @param orderId - The order ID to lookup
   */
  async function getPurchaseOrderFromStorage(orderId: number) {
    try {
      const contractAddress = PURCHASE_ORDER_STORAGE_CONTRACT.split(".")[0];
      const contractName = PURCHASE_ORDER_STORAGE_CONTRACT.split(".")[1];

      const result: any = await fetchReadOnlyFunction({
        network: network,
        contractAddress,
        contractName,
        senderAddress: contractAddress,
        functionArgs: [uintCV(orderId)],
        functionName: "get-order",
      });
      return result;
    } catch (e: any) {
      console.error("Error fetching purchase order:", e);
      return null;
    }
  }

  /**
   * Get the current order ID nonce from storage
   */
  async function getCurrentOrderIdNonce() {
    try {
      const contractAddress = PURCHASE_ORDER_STORAGE_CONTRACT.split(".")[0];
      const contractName = PURCHASE_ORDER_STORAGE_CONTRACT.split(".")[1];

      const result: any = await fetchReadOnlyFunction({
        network: network,
        contractAddress,
        contractName,
        senderAddress: contractAddress,
        functionArgs: [],
        functionName: "get-order-id-nonce",
      });
      return result;
    } catch (e: any) {
      console.error("Error fetching order ID nonce:", e);
      return null;
    }
  }

  /**
   * Create a vault (collateralized loan position) for a purchase order
   * @param collateralStx - STX collateral amount
   * @param collateralBtc - BTC collateral amount
   * @param loanAmount - Loan amount requested
   * @param duration - Loan duration in days
   */
  async function createVault(
    collateralStx: number,
    collateralBtc: number,
    loanAmount: number,
    duration: number
  ): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const contractAddress = TARAL_PURCHASE_ORDER_CONTRACT.split(".")[0];
      const contractName = TARAL_PURCHASE_ORDER_CONTRACT.split(".")[1];

      const functionArgs = [
        uintCV(collateralStx),
        uintCV(collateralBtc),
        uintCV(loanAmount),
        uintCV(duration),
      ];

      if (isSignedIn) {
        await openContractCall({
          contractAddress,
          contractName,
          functionName: "create-vault",
          functionArgs: functionArgs,
          postConditionMode: PostConditionMode.Allow,

          onFinish: async (data: any) => {
            console.log("Vault created!", data);
            resolve(data);
          },
          onCancel: () => {
            console.log("Vault creation cancelled");
            reject(new Error("User cancelled transaction"));
          },
        });
      } else {
        reject(new Error("User not signed in"));
      }
    });
  }

  /**
   * Repay loan on a vault
   * @param vaultId - The vault ID
   * @param repaymentAmount - Amount to repay
   */
  async function repayLoan(vaultId: number, repaymentAmount: number): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const contractAddress = TARAL_PURCHASE_ORDER_CONTRACT.split(".")[0];
      const contractName = TARAL_PURCHASE_ORDER_CONTRACT.split(".")[1];

      const functionArgs = [
        uintCV(vaultId),
        uintCV(repaymentAmount),
      ];

      if (isSignedIn) {
        await openContractCall({
          contractAddress,
          contractName,
          functionName: "repay-loan",
          functionArgs: functionArgs,
          postConditionMode: PostConditionMode.Allow,

          onFinish: async (data: any) => {
            console.log("Loan repaid!", data);
            resolve(data);
          },
          onCancel: () => {
            console.log("Loan repayment cancelled");
            reject(new Error("User cancelled transaction"));
          },
        });
      } else {
        reject(new Error("User not signed in"));
      }
    });
  }

  return {
    // general variables
    stxAddress,
    isSignedIn,

    // core onChain helper functions
    registerTaralImporterOnChain,
    createTaralPurchaseOrder,
    getPurchaseOrderById,
    checkPurchaseOrderHasActiveFinancing,
    acceptFinancing,
    getActivePurchaseOrder,
    makePayment,
    finance,

    // purchase order contract functions
    initializePurchaseOrder,
    getPurchaseOrderFromStorage,
    getCurrentOrderIdNonce,
    createVault,
    repayLoan,
  };
}
export default useTaralContracts;
