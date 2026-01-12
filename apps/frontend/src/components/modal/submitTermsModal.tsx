import {
  faClose,
  faCheckCircle,
  faSpinner,
  faFileAlt,
  faHandshake,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import useTaralContracts from "@hooks/useTaralContracts";
import { generateOrderDetailHash } from "@utils/lib/hashUtils";
import { useState } from "react";
import { toast } from "sonner";
import { CreatePaymentTerm } from "src/types/payment_terms";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  paymentTerms: CreatePaymentTerm;
  orderDetails: {
    exportPort: string;
    importPort: string;
    products: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
    }>;
  };
  counterpartyPrincipal: string;
  onSuccess?: (txData: any) => void;
};

type SubmitState = "idle" | "generating" | "submitting" | "success" | "error";

function SubmitTermsModal({
  isOpen,
  onClose,
  applicationId,
  paymentTerms,
  orderDetails,
  counterpartyPrincipal,
  onSuccess,
}: Props) {
  const { isSignedIn, stxAddress } = useTaralContracts();
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [txId, setTxId] = useState<string | null>(null);
  const [termsHash, setTermsHash] = useState<string | null>(null);

  const formatCurrency = (amount: number | null | undefined, currency: string | null | undefined) => {
    if (!amount) return "N/A";
    return `${currency || "USD"} ${amount.toLocaleString()}`;
  };

  const handleSubmit = async () => {
    if (!isSignedIn) {
      toast.error("Please connect your wallet first");
      return;
    }

    setSubmitState("generating");

    try {
      // Generate hash of the terms for on-chain storage
      const hash = await generateOrderDetailHash({
        ...paymentTerms,
        ...orderDetails,
        applicationId,
        timestamp: Date.now(),
      });
      setTermsHash(hash);

      setSubmitState("submitting");

      // TODO: Call actual contract function to submit terms on-chain
      // For now, simulate the submission
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setTxId("0x" + hash.slice(0, 16) + "..."); // Simulated tx ID
      setSubmitState("success");
      toast.success("Payment terms submitted on-chain!");

      if (onSuccess) {
        onSuccess({ txId: hash, termsHash: hash });
      }
    } catch (error: any) {
      console.error("Error submitting terms:", error);
      setSubmitState("error");
      toast.error(error.message || "Failed to submit terms");
    }
  };

  const handleClose = () => {
    setSubmitState("idle");
    setTxId(null);
    setTermsHash(null);
    onClose();
  };

  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  if (!isOpen) return null;

  return (
    <div className={"newApplicationModal active"}>
      <div className="modalMenue" style={{ maxWidth: "650px" }}>
        <div onClick={handleClose} className="close">
          <FontAwesomeIcon icon={faClose} />
        </div>

        <div className="form" style={{ flexDirection: "column", gap: "20px" }}>
          {/* Header */}
          <div style={{ textAlign: "center", width: "100%" }}>
            {submitState === "success" ? (
              <FontAwesomeIcon
                icon={faCheckCircle}
                style={{ fontSize: "48px", color: "#4CAF50", marginBottom: "10px" }}
              />
            ) : (
              <FontAwesomeIcon
                icon={faHandshake}
                style={{ fontSize: "36px", color: "#1976d2", marginBottom: "10px" }}
              />
            )}
            <div className="header-application">
              {submitState === "success"
                ? "Terms Submitted Successfully!"
                : "Submit Payment Terms On-Chain"}
            </div>
            {submitState !== "success" && (
              <div className="info-application" style={{ marginTop: "10px" }}>
                Review the terms below before submitting to the blockchain for counterparty approval.
              </div>
            )}
          </div>

          {submitState === "success" ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <p>Your payment terms have been submitted to the blockchain.</p>
              <p style={{ color: "#666", marginTop: "10px" }}>
                The counterparty will be notified to review and approve the terms.
              </p>
              {termsHash && (
                <div style={{ marginTop: "15px" }}>
                  <span style={{ fontWeight: "bold" }}>Terms Hash:</span>
                  <br />
                  <code
                    style={{
                      fontSize: "12px",
                      backgroundColor: "#f5f5f5",
                      padding: "8px",
                      borderRadius: "4px",
                      display: "inline-block",
                      marginTop: "5px",
                      wordBreak: "break-all",
                    }}
                  >
                    {termsHash}
                  </code>
                </div>
              )}
              <div style={{ marginTop: "20px" }}>
                <button className="btn" onClick={handleClose}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Payment Terms Summary */}
              <div
                style={{
                  backgroundColor: "#f9f9f9",
                  padding: "20px",
                  borderRadius: "8px",
                  width: "100%",
                }}
              >
                <h4 style={{ marginBottom: "15px", color: "#333" }}>
                  <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: "8px" }} />
                  Payment Terms Summary
                </h4>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                  <div>
                    <span style={{ color: "#666", fontSize: "12px" }}>PAYMENT TYPE</span>
                    <br />
                    <span style={{ fontWeight: "bold" }}>{paymentTerms.paymentType || "Short"}</span>
                  </div>
                  <div>
                    <span style={{ color: "#666", fontSize: "12px" }}>DURATION</span>
                    <br />
                    <span style={{ fontWeight: "bold" }}>{paymentTerms.paymentDuration || 30} days</span>
                  </div>
                  <div>
                    <span style={{ color: "#666", fontSize: "12px" }}>DOWNPAYMENT</span>
                    <br />
                    <span style={{ fontWeight: "bold" }}>
                      {formatCurrency(paymentTerms.downpaymentAmount, paymentTerms.downpaymentCurrency)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#666", fontSize: "12px" }}>BALANCE</span>
                    <br />
                    <span style={{ fontWeight: "bold" }}>
                      {formatCurrency(paymentTerms.balanceAmount, paymentTerms.balanceCurrency)}
                    </span>
                  </div>
                  {paymentTerms.interestExists && (
                    <>
                      <div>
                        <span style={{ color: "#666", fontSize: "12px" }}>INTEREST TYPE</span>
                        <br />
                        <span style={{ fontWeight: "bold" }}>{paymentTerms.interestType}</span>
                      </div>
                      <div>
                        <span style={{ color: "#666", fontSize: "12px" }}>INTEREST RATE</span>
                        <br />
                        <span style={{ fontWeight: "bold" }}>
                          {paymentTerms.interestPercentage || paymentTerms.interestFixedRate || paymentTerms.interestDegressiveRate}%
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {paymentTerms.balancePaymentDeadline && (
                  <div style={{ marginTop: "15px" }}>
                    <span style={{ color: "#666", fontSize: "12px" }}>BALANCE DUE DATE</span>
                    <br />
                    <span style={{ fontWeight: "bold" }}>{paymentTerms.balancePaymentDeadline}</span>
                  </div>
                )}
              </div>

              {/* Order Details */}
              <div
                style={{
                  backgroundColor: "#f9f9f9",
                  padding: "20px",
                  borderRadius: "8px",
                  width: "100%",
                }}
              >
                <h4 style={{ marginBottom: "15px", color: "#333" }}>Order Details</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                  <div>
                    <span style={{ color: "#666", fontSize: "12px" }}>EXPORT PORT</span>
                    <br />
                    <span style={{ fontWeight: "bold" }}>{orderDetails.exportPort || "N/A"}</span>
                  </div>
                  <div>
                    <span style={{ color: "#666", fontSize: "12px" }}>IMPORT PORT</span>
                    <br />
                    <span style={{ fontWeight: "bold" }}>{orderDetails.importPort || "N/A"}</span>
                  </div>
                </div>
                {orderDetails.products && orderDetails.products.length > 0 && (
                  <div style={{ marginTop: "15px" }}>
                    <span style={{ color: "#666", fontSize: "12px" }}>PRODUCTS</span>
                    <br />
                    <span style={{ fontWeight: "bold" }}>{orderDetails.products.length} item(s)</span>
                  </div>
                )}
              </div>

              {/* Counterparty Info */}
              <div
                style={{
                  backgroundColor: "#e8f4fd",
                  padding: "15px",
                  borderRadius: "8px",
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ color: "#666", fontSize: "12px" }}>YOUR WALLET</span>
                    <br />
                    <span style={{ fontFamily: "monospace", fontSize: "14px" }}>
                      {stxAddress ? truncateAddress(stxAddress) : "Not connected"}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ color: "#666", fontSize: "12px" }}>COUNTERPARTY</span>
                    <br />
                    <span style={{ fontFamily: "monospace", fontSize: "14px" }}>
                      {truncateAddress(counterpartyPrincipal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Approval Notice */}
              <div
                style={{
                  backgroundColor: "#fff3e0",
                  padding: "15px",
                  borderRadius: "8px",
                  width: "100%",
                  fontSize: "14px",
                }}
              >
                <strong>Note:</strong> Once submitted, the counterparty will need to approve these terms
                before the transaction can proceed. You will be notified when they respond.
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "15px",
                  justifyContent: "center",
                  marginTop: "10px",
                }}
              >
                <button
                  className="btn"
                  style={{ backgroundColor: "#ccc", color: "#333" }}
                  onClick={handleClose}
                  disabled={submitState === "submitting" || submitState === "generating"}
                >
                  Cancel
                </button>
                <button
                  className="btn"
                  onClick={handleSubmit}
                  disabled={submitState === "submitting" || submitState === "generating" || !isSignedIn}
                >
                  {submitState === "generating" ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: "8px" }} />
                      Generating Hash...
                    </>
                  ) : submitState === "submitting" ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: "8px" }} />
                      Submitting...
                    </>
                  ) : (
                    "Submit Terms On-Chain"
                  )}
                </button>
              </div>

              {!isSignedIn && (
                <div
                  style={{
                    color: "#f44336",
                    textAlign: "center",
                    fontSize: "14px",
                    marginTop: "10px",
                  }}
                >
                  Please connect your wallet to submit
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SubmitTermsModal;
