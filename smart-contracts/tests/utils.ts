import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

export function getScByteCode(folderName: string, fileName: string): Buffer {
  // Obtain the current file name and directory paths
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(path.dirname(__filename));
  return readFileSync(path.join(__dirname, folderName, fileName));
}

export function calculateExpectedSwapAddedAmount(
  amount: number,
  inputFee: number = 0.3,
  protocolFee: number = 0.05,
): number {
  const feeRate = (amount * inputFee) / 100;
  const protocolFeeAmount = (feeRate * protocolFee) / 100;
  const amountWithoutFee = amount - protocolFeeAmount;

  return amountWithoutFee;
}

export function calculateProtocolFeeAmount(
  amount: number,
  inputFee: number = 0.3,
  protocolFee: number = 0.05,
): number {
  const feeRate = (amount * inputFee) / 100;
  const protocolFeeAmount = (feeRate * protocolFee) / 100;
  return protocolFeeAmount;
}

export const TOKEN_DEFAULT_DECIMALS = 9;

export const NATIVE_MAS_COIN_ADDRESS = 'NATIVE_COIN';

export function truncateDecimals(
  amount: number,
  decimals: number = TOKEN_DEFAULT_DECIMALS,
): string {
  // Fixes the number to the specified number of decimals + 1 to prevent rounding errors
  const roundedAmount = amount.toFixed(decimals + 1);
  // truncate the last decimal to get the desired number of decimals
  return roundedAmount.slice(0, roundedAmount.length - 1);
}
