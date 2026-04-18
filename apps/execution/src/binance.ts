import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';

// BINANCE_TESTNET_URL is required (no localhost fallback for production)
const BINANCE_BASE_URL = process.env.BINANCE_TESTNET_URL || process.env.BINANCE_BASE_URL;
if (!BINANCE_BASE_URL) {
  throw new Error('BINANCE_TESTNET_URL or BINANCE_BASE_URL environment variable is required');
}

/**
 * Creates a signed request for Binance API
 * Binance requires HMAC-SHA256 signature for authenticated requests
 */
export function signRequest(
  queryString: string,
  secretKey: string
): string {
  return crypto
    .createHmac('sha256', secretKey)
    .update(queryString)
    .digest('hex');
}

/**
 * Creates an axios instance configured for Binance API
 */
function createBinanceClient(apiKey: string): AxiosInstance {
  return axios.create({
    baseURL: BINANCE_BASE_URL,
    headers: {
      'X-MBX-APIKEY': apiKey,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });
}

/**
 * Places an order on Binance testnet
 * Returns the order response or throws an error
 */
export async function placeOrder(
  apiKey: string,
  secretKey: string,
  orderParams: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT';
    quantity: number;
    price?: number;
  }
): Promise<any> {
  const client = createBinanceClient(apiKey);

  // Build query parameters
  const params: Record<string, string> = {
    symbol: orderParams.symbol,
    side: orderParams.side,
    type: orderParams.type,
    quantity: orderParams.quantity.toString(),
    timestamp: Date.now().toString(),
  };

  // Add price for LIMIT orders
  if (orderParams.type === 'LIMIT' && orderParams.price) {
    params.price = orderParams.price.toString();
    params.timeInForce = 'GTC'; // Good Till Cancel
  }

  // Create query string
  const queryString = new URLSearchParams(params).toString();

  // Sign the request
  const signature = signRequest(queryString, secretKey);

  // Add signature to query string
  const signedQueryString = `${queryString}&signature=${signature}`;

  try {
    // Make the request
    const response = await client.post(`/api/v3/order?${signedQueryString}`);

    return response.data;
  } catch (error: any) {
    // Extract error message from Binance response
    if (error.response?.data) {
      throw new Error(
        `Binance API error: ${error.response.data.msg || JSON.stringify(error.response.data)}`
      );
    }
    throw error;
  }
}

/**
 * Cancels an order on Binance testnet
 * Returns the cancel response or throws an error
 */
export async function cancelOrder(
  apiKey: string,
  secretKey: string,
  orderParams: {
    symbol: string;
    orderId: string;
  }
): Promise<any> {
  const client = createBinanceClient(apiKey);

  // Build query parameters
  const params: Record<string, string> = {
    symbol: orderParams.symbol,
    orderId: orderParams.orderId,
    timestamp: Date.now().toString(),
  };

  // Create query string
  const queryString = new URLSearchParams(params).toString();

  // Sign the request
  const signature = signRequest(queryString, secretKey);

  // Add signature to query string
  const signedQueryString = `${queryString}&signature=${signature}`;

  try {
    // Make the request
    const response = await client.delete(`/api/v3/order?${signedQueryString}`);

    return response.data;
  } catch (error: any) {
    // Extract error message from Binance response
    if (error.response?.data) {
      throw new Error(
        `Binance API error: ${error.response.data.msg || JSON.stringify(error.response.data)}`
      );
    }
    throw error;
  }
}

