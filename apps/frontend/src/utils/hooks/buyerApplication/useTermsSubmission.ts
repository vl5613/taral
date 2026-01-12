import buyerApplicationService from "@services/application/buyerApplicationService";
import { useQuery } from "@tanstack/react-query";
import { CreatePaymentTerm } from "src/types/payment_terms";
import { GetOrderDetailsResponse } from "src/types/order_details";
import { GetSupplierInfoResponse } from "src/types/supplier_info_for_buyer";

interface TermsSubmissionData {
  paymentTerms: CreatePaymentTerm | null;
  orderDetails: {
    exportPort: string;
    importPort: string;
    products: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
    }>;
  } | null;
  supplierInfo: GetSupplierInfoResponse | null;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Hook to fetch all data needed for on-chain terms submission
 * Fetches payment terms, order details, and supplier info
 */
const useTermsSubmission = (applicationId: string): TermsSubmissionData => {
  // Fetch order details
  const orderDetailsQuery = useQuery({
    queryKey: ["orderDetails", applicationId],
    queryFn: async () => {
      try {
        const response = await buyerApplicationService.getOrderDetailInfo(applicationId);
        return response;
      } catch (error) {
        console.error("Error fetching order details:", error);
        return null;
      }
    },
    enabled: !!applicationId,
  });

  // Fetch supplier info
  const supplierInfoQuery = useQuery({
    queryKey: ["supplierInfo", applicationId],
    queryFn: async () => {
      try {
        const response = await buyerApplicationService.getSupplierInfo(applicationId);
        return response;
      } catch (error) {
        console.error("Error fetching supplier info:", error);
        return null;
      }
    },
    enabled: !!applicationId,
  });

  // Fetch payment terms
  const paymentTermsQuery = useQuery({
    queryKey: ["paymentTermsForSubmission", applicationId],
    queryFn: async () => {
      try {
        const response = await buyerApplicationService.getPaymentTerms(applicationId);
        return response;
      } catch (error) {
        console.error("Error fetching payment terms:", error);
        return null;
      }
    },
    enabled: !!applicationId,
  });

  // Transform order details to the format expected by SubmitTermsModal
  const orderDetails = orderDetailsQuery.data
    ? {
        exportPort: orderDetailsQuery.data.exportPort || "",
        importPort: orderDetailsQuery.data.importPort || "",
        products: (orderDetailsQuery.data.products || []).map((p) => ({
          name: p.name,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
        })),
      }
    : null;

  // Transform payment terms response to CreatePaymentTerm format
  const paymentTerms = paymentTermsQuery.data
    ? {
        isConcluded: paymentTermsQuery.data.isConcluded,
        partialRefinancing: paymentTermsQuery.data.partialRefinancing,
        interestExists: paymentTermsQuery.data.interestExists,
        interestPercentage: paymentTermsQuery.data.interestPercentage,
        interestCurrency: paymentTermsQuery.data.interestCurrency,
        interestType: paymentTermsQuery.data.interestType,
        interestFixedRate: paymentTermsQuery.data.interestFixedRate,
        interestDegressiveRate: paymentTermsQuery.data.interestDegressiveRate,
        paymentType: paymentTermsQuery.data.paymentType,
        downpaymentCurrency: paymentTermsQuery.data.downpaymentCurrency,
        downpaymentAmount: parseFloat(paymentTermsQuery.data.downpaymentAmount as any) || 0,
        downpaymentDescription: paymentTermsQuery.data.downpaymentDescription,
        balanceCurrency: paymentTermsQuery.data.balanceCurrency,
        balanceAmount: parseFloat(paymentTermsQuery.data.balanceAmount as any) || 0,
        balancePaymentDeadline: paymentTermsQuery.data.balancePaymentDeadline,
        paymentVehicleDescription: paymentTermsQuery.data.paymentVehicleDescription,
        paymentDuration: paymentTermsQuery.data.paymentDuration,
      } as CreatePaymentTerm
    : null;

  return {
    paymentTerms,
    orderDetails,
    supplierInfo: supplierInfoQuery.data || null,
    isLoading:
      orderDetailsQuery.isLoading ||
      supplierInfoQuery.isLoading ||
      paymentTermsQuery.isLoading,
    isError:
      orderDetailsQuery.isError ||
      supplierInfoQuery.isError ||
      paymentTermsQuery.isError,
  };
};

export default useTermsSubmission;
