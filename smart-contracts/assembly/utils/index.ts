// function to check teh address validity
export function isValidAddress(address: string): bool {
  return address.length > 50 && address.length < 54 && address.startsWith('AU');
}

// function to check teh address validity
export function isValidSmartContractAddress(address: string): bool {
  return address.length > 50 && address.length < 54 && address.startsWith('AS');
}

/**
 * Builds a pool key using the token addresses and the input fee rate.
 * @param tokenA - Address of token A.
 * @param tokenB - Address of token B.
 * @param inputFeeRate - Input fee rate for the pool.
 * @returns string - Pool key.
 */
export function _buildPoolKey(
  tokenA: string,
  tokenB: string,
  inputFeeRate: f64,
): string {
  // sort the addresses to ensure that the key of the pool is always the same
  if (tokenA > tokenB) {
    const temp = tokenA;
    tokenA = tokenB;
    tokenB = temp;
  }
  const key = `${tokenA}-${tokenB}-${inputFeeRate.toString()}`;
  return key;
}

export const DEFAULT_DECIMALS = 9;

/**
 * Asserts that the token decimals are either 9 or 18.
 * @param decimals - Decimals of the token.
 * @returns void
 * @throws if the token decimals are not 9 or 18.
 */
export function assertIsValidTokenDecimals(decimals: u8): void {
  assert(
    decimals == 9 || decimals == 18,
    'Invalid token decimals. Must be 9 or 18.',
  );
}
