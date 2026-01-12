import {
  faClose,
  faCheckCircle,
  faTimesCircle,
  faSpinner,
  faFileContract,
  faPen,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import useTaralContracts from "@hooks/useTaralContracts";
import { useState } from "react";
import { toast } from "sonner";
import {
  PurchaseOrderContract,
  ContractTerms,
  ContractStatus,
} from "src/types/contract";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  contract: PurchaseOrderContract | null;
  terms?: ContractTerms;
  userRole: "exporter" | "importer";
  onSignSuccess?: () => void;
};

type ActionState = "idle" | "signing" | "rejecting" | "success" | "error";

function ContractViewerModal({
  isOpen,
  onClose,
  orderId,
  contract,
  terms,
  userRole,
  onSignSuccess,
}: Props) {
  const { isSignedIn, stxAddress, signAsExporter, signAsImporter, rejectOrder } = useTaralContracts();
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

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

  const getStatusColor = (status: ContractStatus) => {
    switch (status) {
      case "pending":
        return "#FFA500";
      case "awaiting_signatures":
        return "#2196F3";
      case "signed":
        return "#4CAF50";
      case "rejected":
        return "#f44336";
      case "completed":
        return "#4CAF50";
      case "cancelled":
        return "#9E9E9E";
      default:
        return "#666";
    }
  };

  const getStatusLabel = (status: ContractStatus) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "awaiting_signatures":
        return "Awaiting Signatures";
      case "signed":
        return "Signed";
      case "rejected":
        return "Rejected";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  const handleSign = async () => {
    if (!isSignedIn) {
      toast.error("Please connect your wallet first");
      return;
    }

    setActionState("signing");

    try {
      // Call the appropriate signing function based on user role
      if (userRole === "exporter") {
        await signAsExporter(orderId);
      } else {
        await signAsImporter(orderId);
      }

      setActionState("success");
      toast.success("Contract signed successfully!");

      if (onSignSuccess) {
        onSignSuccess();
      }
    } catch (error: any) {
      console.error("Error signing contract:", error);
      setActionState("error");
      toast.error(error.message || "Failed to sign contract");
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setActionState("rejecting");

    try {
      // Call the reject order contract function
      await rejectOrder(orderId, rejectionReason);

      setActionState("success");
      toast.success("Contract rejected");
      setShowRejectForm(false);

      if (onSignSuccess) {
        onSignSuccess();
      }
    } catch (error: any) {
      console.error("Error rejecting contract:", error);
      setActionState("error");
      toast.error(error.message || "Failed to reject contract");
    }
  };

  const canSign = () => {
    if (!contract || !isSignedIn || !stxAddress) return false;

    const userSignature = contract.signatures.find(
      (sig) => sig.role === userRole
    );

    return userSignature && !userSignature.signed;
  };

  const handleClose = () => {
    setActionState("idle");
    setShowRejectForm(false);
    setRejectionReason("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={"newApplicationModal active"}>
      <div className="modalMenue" style={{ maxWidth: "800px", maxHeight: "90vh", overflow: "auto" }}>
        <div onClick={handleClose} className="close">
          <FontAwesomeIcon icon={faClose} />
        </div>

        <div className="form" style={{ flexDirection: "column", gap: "20px", padding: "20px" }}>
          {/* Header */}
          <div style={{ textAlign: "center", width: "100%" }}>
            <FontAwesomeIcon
              icon={faFileContract}
              style={{ fontSize: "36px", color: "#1976d2", marginBottom: "10px" }}
            />
            <div className="header-application">
              Purchase Order Contract #{orderId}
            </div>
            {contract && (
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  borderRadius: "16px",
                  backgroundColor: getStatusColor(contract.status),
                  color: "white",
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginTop: "10px",
                }}
              >
                {getStatusLabel(contract.status)}
              </div>
            )}
          </div>

          {/* Contract Details */}
          {contract && (
            <>
              {/* Parties Section */}
              <div
                style={{
                  backgroundColor: "#f5f5f5",
                  padding: "20px",
                  borderRadius: "8px",
                  width: "100%",
                }}
              >
                <h4 style={{ marginBottom: "15px", color: "#333" }}>
                  Contract Parties
                </h4>
                <div style={{ display: "grid", gap: "15px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px",
                      backgroundColor: "white",
                      borderRadius: "4px",
                    }}
                  >
                    <div>
                      <span style={{ color: "#666", fontSize: "12px" }}>
                        EXPORTER
                      </span>
                      <br />
                      <span style={{ fontFamily: "monospace" }}>
                        {truncateAddress(contract.exporterPrincipal)}
                      </span>
                    </div>
                    {contract.signatures.find((s) => s.role === "exporter")
                      ?.signed ? (
                      <FontAwesomeIcon
                        icon={faCheckCircle}
                        style={{ color: "#4CAF50", fontSize: "20px" }}
                      />
                    ) : (
                      <span
                        style={{
                          color: "#FFA500",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                      >
                        Awaiting Signature
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px",
                      backgroundColor: "white",
                      borderRadius: "4px",
                    }}
                  >
                    <div>
                      <span style={{ color: "#666", fontSize: "12px" }}>
                        IMPORTER
                      </span>
                      <br />
                      <span style={{ fontFamily: "monospace" }}>
                        {truncateAddress(contract.importerPrincipal)}
                      </span>
                    </div>
                    {contract.signatures.find((s) => s.role === "importer")
                      ?.signed ? (
                      <FontAwesomeIcon
                        icon={faCheckCircle}
                        style={{ color: "#4CAF50", fontSize: "20px" }}
                      />
                    ) : (
                      <span
                        style={{
                          color: "#FFA500",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                      >
                        Awaiting Signature
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contract Terms Section */}
              <div
                style={{
                  backgroundColor: "#f5f5f5",
                  padding: "20px",
                  borderRadius: "8px",
                  width: "100%",
                }}
              >
                <h4 style={{ marginBottom: "15px", color: "#333" }}>
                  Contract Terms
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
                      ORDER AMOUNT
                    </span>
                    <br />
                    <span style={{ fontWeight: "bold", fontSize: "18px" }}>
                      {formatAmount(contract.amount)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#666", fontSize: "12px" }}>
                      PAYMENT TERM
                    </span>
                    <br />
                    <span style={{ fontWeight: "bold" }}>
                      {contract.paymentTerm}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#666", fontSize: "12px" }}>
                      DELIVERY TERM
                    </span>
                    <br />
                    <span style={{ fontWeight: "bold" }}>
                      {contract.deliveryTerm}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#666", fontSize: "12px" }}>
                      ORDER ID
                    </span>
                    <br />
                    <span style={{ fontWeight: "bold" }}>#{orderId}</span>
                  </div>
                </div>
              </div>

              {/* Additional Terms if provided */}
              {terms && (
                <div
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: "20px",
                    borderRadius: "8px",
                    width: "100%",
                  }}
                >
                  <h4 style={{ marginBottom: "15px", color: "#333" }}>
                    Payment Details
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
                      <span style={{ fontWeight: "bold" }}>
                        {terms.downpaymentCurrency} {terms.downpaymentAmount}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: "#666", fontSize: "12px" }}>
                        BALANCE
                      </span>
                      <br />
                      <span style={{ fontWeight: "bold" }}>
                        {terms.balanceCurrency} {terms.balanceAmount}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: "#666", fontSize: "12px" }}>
                        BALANCE DUE DATE
                      </span>
                      <br />
                      <span style={{ fontWeight: "bold" }}>
                        {terms.balancePaymentDeadline}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: "#666", fontSize: "12px" }}>
                        PAYMENT DURATION
                      </span>
                      <br />
                      <span style={{ fontWeight: "bold" }}>
                        {terms.paymentDuration} days
                      </span>
                    </div>
                    {terms.interestExists && (
                      <>
                        <div>
                          <span style={{ color: "#666", fontSize: "12px" }}>
                            INTEREST TYPE
                          </span>
                          <br />
                          <span style={{ fontWeight: "bold" }}>
                            {terms.interestType}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: "#666", fontSize: "12px" }}>
                            INTEREST RATE
                          </span>
                          <br />
                          <span style={{ fontWeight: "bold" }}>
                            {terms.interestPercentage}%
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Hashes Section */}
              <div
                style={{
                  backgroundColor: "#e8f4fd",
                  padding: "15px",
                  borderRadius: "8px",
                  width: "100%",
                }}
              >
                <h4 style={{ marginBottom: "10px", color: "#1976d2" }}>
                  On-Chain Verification
                </h4>
                <div style={{ fontSize: "12px" }}>
                  <div style={{ marginBottom: "8px" }}>
                    <span style={{ color: "#666" }}>Order Hash:</span>
                    <br />
                    <code
                      style={{
                        backgroundColor: "white",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        wordBreak: "break-all",
                      }}
                    >
                      {contract.orderHash}
                    </code>
                  </div>
                  <div>
                    <span style={{ color: "#666" }}>Detail Hash:</span>
                    <br />
                    <code
                      style={{
                        backgroundColor: "white",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        wordBreak: "break-all",
                      }}
                    >
                      {contract.orderDetailHash}
                    </code>
                  </div>
                </div>
              </div>

              {/* Rejection Form */}
              {showRejectForm && (
                <div
                  style={{
                    backgroundColor: "#ffebee",
                    padding: "20px",
                    borderRadius: "8px",
                    width: "100%",
                  }}
                >
                  <h4 style={{ marginBottom: "10px", color: "#c62828" }}>
                    Rejection Reason
                  </h4>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please provide a reason for rejecting this contract..."
                    style={{
                      width: "100%",
                      minHeight: "100px",
                      padding: "10px",
                      borderRadius: "4px",
                      border: "1px solid #ef9a9a",
                      marginBottom: "10px",
                    }}
                  />
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      className="btn"
                      style={{ backgroundColor: "#ccc", color: "#333" }}
                      onClick={() => setShowRejectForm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn"
                      style={{ backgroundColor: "#c62828" }}
                      onClick={handleReject}
                      disabled={actionState === "rejecting"}
                    >
                      {actionState === "rejecting" ? (
                        <>
                          <FontAwesomeIcon
                            icon={faSpinner}
                            spin
                            style={{ marginRight: "8px" }}
                          />
                          Rejecting...
                        </>
                      ) : (
                        "Confirm Rejection"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {canSign() && !showRejectForm && (
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
                    style={{ backgroundColor: "#c62828" }}
                    onClick={() => setShowRejectForm(true)}
                    disabled={actionState === "signing"}
                  >
                    <FontAwesomeIcon
                      icon={faTimesCircle}
                      style={{ marginRight: "8px" }}
                    />
                    Reject Contract
                  </button>
                  <button
                    className="btn"
                    style={{ backgroundColor: "#4CAF50" }}
                    onClick={handleSign}
                    disabled={actionState === "signing"}
                  >
                    {actionState === "signing" ? (
                      <>
                        <FontAwesomeIcon
                          icon={faSpinner}
                          spin
                          style={{ marginRight: "8px" }}
                        />
                        Signing...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon
                          icon={faPen}
                          style={{ marginRight: "8px" }}
                        />
                        Sign Contract
                      </>
                    )}
                  </button>
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
                  Please connect your wallet to sign or reject this contract
                </div>
              )}
            </>
          )}

          {/* Loading State */}
          {!contract && (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <FontAwesomeIcon
                icon={faSpinner}
                spin
                style={{ fontSize: "32px", color: "#1976d2" }}
              />
              <p style={{ marginTop: "15px", color: "#666" }}>
                Loading contract details...
              </p>
            </div>
          )}

          {/* Close Button */}
          <div style={{ textAlign: "center", marginTop: "10px" }}>
            <button
              className="btn"
              style={{ backgroundColor: "#666" }}
              onClick={handleClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContractViewerModal;
