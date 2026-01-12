/**
 * Contract/Purchase Order Types for on-chain representation
 */

export interface PurchaseOrderContract {
  orderId: number;
  exporterPrincipal: string;
  importerPrincipal: string;
  orderHash: string;
  orderDetailHash: string;
  paymentTerm: string;
  amount: number;
  deliveryTerm: string;
  status: ContractStatus;
  createdAt: number; // block height
  signatures: ContractSignature[];
}

export type ContractStatus =
  | "pending"
  | "awaiting_signatures"
  | "signed"
  | "rejected"
  | "completed"
  | "cancelled";

export interface ContractSignature {
  principal: string;
  role: "exporter" | "importer";
  signed: boolean;
  signedAt?: number; // block height
  rejectionReason?: string;
}

export interface ContractTerms {
  paymentType: string;
  paymentDuration: number;
  downpaymentAmount: number;
  downpaymentCurrency: string;
  balanceAmount: number;
  balanceCurrency: string;
  balancePaymentDeadline: string;
  interestExists: boolean;
  interestType?: string;
  interestPercentage?: number;
  deliveryTerm: string;
  exportPort: string;
  importPort: string;
}

export interface ContractViewerProps {
  orderId: number;
  contract?: PurchaseOrderContract;
  terms?: ContractTerms;
  isLoading?: boolean;
  onSign?: () => Promise<void>;
  onReject?: (reason: string) => Promise<void>;
  onClose?: () => void;
}
