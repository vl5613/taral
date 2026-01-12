import { faClose, faCheckCircle, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import useTaralContracts from "@hooks/useTaralContracts";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  orderData: {
    exporterPrincipal: string;
    importerPrincipal: string;
    orderHash: string;
    orderDetailHash: string;
    paymentTerm: string;
    amount: number;
    deliveryTerm: string;
  };
  onSuccess?: (txData: any) => void;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

function SubmitPurchaseOrderModal({ isOpen, onClose, orderData, onSuccess }: Props) {
  const { isSignedIn, initializePurchaseOrder, stxAddress } = useTaralContracts();
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [txId, setTxId] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!isSignedIn) {
      toast.error("Please connect your wallet first");
      return;
    }

    setSubmitState("submitting");

    try {
      const result = await initializePurchaseOrder(
        orderData.exporterPrincipal,
        orderData.importerPrincipal,
        orderData.orderHash,
        orderData.orderDetailHash,
        orderData.paymentTerm,
        orderData.amount,
        orderData.deliveryTerm
      );

      setTxId(result.txId);
      setSubmitState("success");
      toast.success("Purchase order submitted to blockchain!");

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error: any) {
      console.error("Error submitting purchase order:", error);
      setSubmitState("error");
      toast.error(error.message || "Failed to submit purchase order");
    }
  };

  const handleClose = () => {
    setSubmitState("idle");
    setTxId(null);
    onClose();
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount / 1000000); // Assuming 6 decimal places
  };

  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  return (
    <div className={"newApplicationModal " + (isOpen && "active")}>
      {isOpen && (
        <div className="modalMenue" style={{ maxWidth: "600px" }}>
          <div onClick={handleClose} className="close">
            <FontAwesomeIcon icon={faClose} />
          </div>

          <div className="form" style={{ flexDirection: "column", gap: "20px" }}>
            <div style={{ textAlign: "center", width: "100%" }}>
              <div className="header-application">
                {submitState === "success"
                  ? "Purchase Order Submitted!"
                  : "Submit Purchase Order On-Chain"}
              </div>

              {submitState === "idle" && (
                <div className="info-application" style={{ marginTop: "10px" }}>
                  Review the details below and submit your purchase order to the Stacks blockchain.
                </div>
              )}
            </div>

            {submitState === "success" ? (
              <div style={{ textAlign: "center", padding: "20px" }}>
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  style={{ fontSize: "48px", color: "#4CAF50", marginBottom: "20px" }}
                />
                <p>Your purchase order has been submitted to the blockchain.</p>
                {txId && (
                  <div style={{ marginTop: "15px" }}>
                    <span style={{ fontWeight: "bold" }}>Transaction ID:</span>
                    <br />
                    <code style={{
                      fontSize: "12px",
                      backgroundColor: "#f5f5f5",
                      padding: "8px",
                      borderRadius: "4px",
                      display: "inline-block",
                      marginTop: "5px",
                      wordBreak: "break-all"
                    }}>
                      {txId}
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
                {/* Order Details Summary */}
                <div style={{
                  backgroundColor: "#f9f9f9",
                  padding: "20px",
                  borderRadius: "8px",
                  width: "100%"
                }}>
                  <h4 style={{ marginBottom: "15px", color: "#333" }}>Order Details</h4>

                  <div style={{ display: "grid", gap: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#666" }}>Exporter:</span>
                      <span style={{ fontFamily: "monospace" }}>
                        {truncateAddress(orderData.exporterPrincipal)}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#666" }}>Importer:</span>
                      <span style={{ fontFamily: "monospace" }}>
                        {truncateAddress(orderData.importerPrincipal)}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#666" }}>Amount:</span>
                      <span style={{ fontWeight: "bold" }}>
                        {formatAmount(orderData.amount)}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#666" }}>Payment Term:</span>
                      <span>{orderData.paymentTerm}</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#666" }}>Delivery Term:</span>
                      <span>{orderData.deliveryTerm}</span>
                    </div>
                  </div>
                </div>

                {/* Wallet Info */}
                <div style={{
                  backgroundColor: "#e8f4fd",
                  padding: "15px",
                  borderRadius: "8px",
                  width: "100%"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ color: "#1976d2" }}>Connected Wallet:</span>
                    <span style={{ fontFamily: "monospace", fontSize: "14px" }}>
                      {stxAddress ? truncateAddress(stxAddress) : "Not connected"}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{
                  display: "flex",
                  gap: "15px",
                  justifyContent: "center",
                  marginTop: "10px"
                }}>
                  <button
                    className="btn"
                    style={{ backgroundColor: "#ccc", color: "#333" }}
                    onClick={handleClose}
                    disabled={submitState === "submitting"}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn"
                    onClick={handleSubmit}
                    disabled={submitState === "submitting" || !isSignedIn}
                  >
                    {submitState === "submitting" ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: "8px" }} />
                        Submitting...
                      </>
                    ) : (
                      "Submit to Blockchain"
                    )}
                  </button>
                </div>

                {!isSignedIn && (
                  <div style={{
                    color: "#f44336",
                    textAlign: "center",
                    fontSize: "14px",
                    marginTop: "10px"
                  }}>
                    Please connect your wallet to submit
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SubmitPurchaseOrderModal;
