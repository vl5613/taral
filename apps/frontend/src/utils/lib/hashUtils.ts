/**
 * Hash utilities for generating order hashes for on-chain submission
 */

/**
 * Generate SHA256 hash of data
 * @param data - Data to hash (string or object)
 * @returns Hex-encoded SHA256 hash
 */
export async function sha256Hash(data: string | object): Promise<string> {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(text);

  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}

/**
 * Generate order hash from order data
 * This creates a deterministic hash of the core order information
 */
export async function generateOrderHash(orderData: {
  exporterPrincipal: string;
  importerPrincipal: string;
  amount: number;
  paymentTerm: string;
  deliveryTerm: string;
  timestamp?: number;
}): Promise<string> {
  const dataToHash = {
    exporter: orderData.exporterPrincipal,
    importer: orderData.importerPrincipal,
    amount: orderData.amount,
    paymentTerm: orderData.paymentTerm,
    deliveryTerm: orderData.deliveryTerm,
    timestamp: orderData.timestamp || Date.now(),
  };

  return sha256Hash(dataToHash);
}

/**
 * Generate order detail hash from detailed order information
 * This includes additional details like products, ports, etc.
 */
export async function generateOrderDetailHash(orderDetails: {
  products?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  exportPort?: string;
  importPort?: string;
  downpaymentAmount?: number;
  downpaymentCurrency?: string;
  balanceAmount?: number;
  balanceCurrency?: string;
  interestExists?: boolean;
  interestType?: string;
  interestPercentage?: number;
  [key: string]: any;
}): Promise<string> {
  // Sort keys for deterministic hashing
  const sortedDetails = Object.keys(orderDetails)
    .sort()
    .reduce((obj: any, key) => {
      obj[key] = orderDetails[key];
      return obj;
    }, {});

  return sha256Hash(sortedDetails);
}

/**
 * Verify a hash matches the expected data
 */
export async function verifyHash(
  data: string | object,
  expectedHash: string
): Promise<boolean> {
  const computedHash = await sha256Hash(data);
  return computedHash.toLowerCase() === expectedHash.toLowerCase();
}
