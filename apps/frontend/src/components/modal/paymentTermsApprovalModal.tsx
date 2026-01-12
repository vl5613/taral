import {
  faClose,
  faCheckCircle,
  faSpinner,
  faFileContract,
  faTimesCircle,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import useTaralContracts from "@hooks/useTaralContracts";
import { useState, useEffect } from "react";
import { toast } from "sonner";

type PaymentTermsData = {
  termsHash: string;
  downpaymentAmount: number;
  balanceAmount: number;
  paymentDurationDays: number;
  interestRate: number;
  submittedBy: string;
  approvedByCounterparty: boolean;
  submittedAt: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  userRole: "exporter" | "importer";
  onApprovalSuccess?: () => void;
};

type ActionState = "idle" | "loading" | "approving" | "success" | "error";

function PaymentTermsApprovalModal({
  isOpen,
  onClose,
  orderId,
  userRole,
  onApprovalSuccess,
}: Props) {
  const { isSignedIn, stxAddress, approvePaymentTerms, getPaymentTermsDetail } = useTaralContracts();
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [termsData, setTermsData] = useState<PaymentTermsData | null>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      loadPaymentTerms();
    }
  }, [isOpen, orderId]);

  const loadPaymentTerms = async () => {
    setActionState("loading");
    try {
      const data = await getPaymentTermsDetail(orderId);
      if (data) {
        setTermsData({
          termsHash: data["terms-hash"] || "",
          downpaymentAmount: Number(data["downpayment-amount"]) || 0,
          balanceAmount: Number(data["balance-amount"]) || 0,
          paymentDurationDays: Number(data["payment-duration-days"]) || 0,
          interestRate: Number(data["interest-rate"]) || 0,
          submittedBy: data["submitted-by"] || "",
          approvedByCounterparty: data["approved-by-counterparty"] || false,
          submittedAt: Number(data["submitted-at"]) || 0,
        });
      }
      setActionState("idle");
    } catch (error) {
      console.error("Error loading payment terms:", error);
      setActionState("error");
    }
  };

  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount / 1000000);
  };

  const formatInterestRate = (basisPoints: number) => {
    return `${(basisPoints / 100).toFixed(2)}%`;
  };

  const handleApprove = async () => {
    if (!isSignedIn) {
      toast.error("Please connect your wallet first");
      return;
    }

    setActionState("approving");

    try {
      await approvePaymentTerms(orderId);

      setActionState("success");
      toast.success("Payment terms approved!");

      if (onApprovalSuccess) {
        onApprovalSuccess();
      }
    } catch (error: any) {
      console.error("Error approving payment terms:", error);
      setActionState("error");
      toast.error(error.message || "Failed to approve payment terms");
    }
  };

  const handleClose = () => {
    setActionState("idle");
    onClose();
  };

  const canApprove = () => {
    if (!termsData || !isSignedIn || !stxAddress) return false;
    // Can only approve if not already approved and you're not the submitter
    return !termsData.approvedByCounterparty && termsData.submittedBy !== stxAddress;
  };

  if (!isOpen) return null;

  return (
    <div className={"newApplicationModal active"}>
      <div className="modalMenue" style={{ maxWidth: "600px" }}>
        <div onClick={handleClose} className="close">
          <FontAwesomeIcon icon={faClose} />
        </div>

        <div className="form" style={{ flexDirection: "column", gap: "20px", padding: "20px" }}>
          {/* Header */}
          <div style={{ textAlign: "center", width: "100%" }}>
            {actionState === "success" ? (
              <FontAwesomeIcon
                icon={faCheckCircle}
                style={{ fontSize: "48px", color: "#4CAF50", marginBottom: "10px" }}
              />
            ) : (
              <FontAwesomeIcon
                icon={faFileContract}
                style={{ fontSize: "36px", color: "#1976d2", marginBottom: "10px" }}
              />
            )}
            <div className="header-application">
              {actionState === "success"
                ? "Payment Terms Approved!"
                : "Review Payment Terms"}
            </div>
            <div className="info-application" style={{ marginTop: "5px" }}>
              Order #{orderId}
            </div>
          </div>

          {actionState === "loading" && (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <FontAwesomeIcon
                icon={faSpinner}
                spin
                style={{ fontSize: "32px", color: "#1976d2" }}
              />
              <p style={{ marginTop: "15px", color: "#666" }}>
                Loading payment terms...
              </p>
            </div>
          )}

          {actionState === "success" && (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <p>The payment terms have been approved.</p>
              <p style={{ color: "#666", marginTop: "10px" }}>
                The transaction can now proceed to the next stage.
              </p>
              <div style={{ marginTop: "20px" }}>
                <button className="btn" onClick={handleClose}>
                  Done
                </button>
              </div>
            </div>
          )}

          {termsData && actionState !== "success" && actionState !== "loading" && (
            <>
              {/* Terms Summary */}
              <div
                style={{
                  backgroundColor: "#f5f5f5",
                  padding: "20px",
                  borderRadius: "8px",
                  width: "100%",
                }}
              >
                <h4 style={{ marginBottom: "15px", color: "#333" }}>
                  Payment Terms Details
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "15px",
                  }}
                >
                  <div>
                    <span style={{ color: "#666", fontSize: "12px" }}>
                      DOWNPAYMENT
                    </span>
                    <br />
                    <span style={{ fontWeight: "bold", fontSize: "18px" }}>
                      {formatAmount(termsData.downpaymentAmount)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#666", fontSize: "12px" }}>
                      BALANCE
                    </span>
                    <br />
                    <span style={{ fontWeight: "bold", fontSize: "18px" }}>
                      {formatAmount(termsData.balanceAmount)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#666", fontSize: "12px" }}>
                      PAYMENT DURATION
                    </span>
                    <br />
                    <span style={{ fontWeight: "bold" }}>
                      {termsData.paymentDurationDays} days
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#666", fontSize: "12px" }}>
                      INTEREST RATE
                    </span>
                    <br />
                    <span style={{ fontWeight: "bold" }}>
                      {formatInterestRate(termsData.interestRate)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submitter Info */}
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
                    <span style={{ color: "#666", fontSize: "12px" }}>SUBMITTED BY</span>
                    <br />
                    <span style={{ fontFamily: "monospace", fontSize: "14px" }}>
                      {truncateAddress(termsData.submittedBy)}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ color: "#666", fontSize: "12px" }}>STATUS</span>
                    <br />
                    {termsData.approvedByCounterparty ? (
                      <span style={{ color: "#4CAF50", fontWeight: "bold" }}>
                        <FontAwesomeIcon icon={faCheckCircle} style={{ marginRight: "5px" }} />
                        Approved
                      </span>
                    ) : (
                      <span style={{ color: "#FFA500", fontWeight: "bold" }}>
                        Awaiting Approval
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Hash Verification */}
              <div
                style={{
                  backgroundColor: "#f9f9f9",
                  padding: "15px",
                  borderRadius: "8px",
                  width: "100%",
                }}
              >
                <span style={{ color: "#666", fontSize: "12px" }}>TERMS HASH</span>
                <br />
                <code
                  style={{
                    fontSize: "12px",
                    backgroundColor: "white",
                    padding: "8px",
                    borderRadius: "4px",
                    display: "inline-block",
                    marginTop: "5px",
                    wordBreak: "break-all",
                  }}
                >
                  {termsData.termsHash}
                </code>
              </div>

              {/* Action Buttons */}
              {canApprove() && (
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
                    disabled={actionState === "approving"}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn"
                    style={{ backgroundColor: "#4CAF50" }}
                    onClick={handleApprove}
                    disabled={actionState === "approving"}
                  >
                    {actionState === "approving" ? (
                      <>
                        <FontAwesomeIcon
                          icon={faSpinner}
                          spin
                          style={{ marginRight: "8px" }}
                        />
                        Approving...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon
                          icon={faCheckCircle}
                          style={{ marginRight: "8px" }}
                        />
                        Approve Terms
                      </>
                    )}
                  </button>
                </div>
              )}

              {termsData.approvedByCounterparty && (
                <div
                  style={{
                    color: "#4CAF50",
                    textAlign: "center",
                    fontSize: "14px",
                    marginTop: "10px",
                  }}
                >
                  These terms have already been approved.
                </div>
              )}

              {!canApprove() && !termsData.approvedByCounterparty && termsData.submittedBy === stxAddress && (
                <div
                  style={{
                    color: "#666",
                    textAlign: "center",
                    fontSize: "14px",
                    marginTop: "10px",
                  }}
                >
                  Waiting for counterparty approval. You submitted these terms.
                </div>
              )}

              {!isSignedIn && (
                <div
                  style={{
                    color: "#f44336",
                    textAlign: "center",
                    fontSize: "14px",
                    marginTop: "10px",
                  }}
                >
                  Please connect your wallet to approve these terms.
                </div>
              )}
            </>
          )}

          {/* Close Button for non-success states */}
          {actionState !== "success" && (
            <div style={{ textAlign: "center", marginTop: "10px" }}>
              <button
                className="btn"
                style={{ backgroundColor: "#666" }}
                onClick={handleClose}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaymentTermsApprovalModal;
