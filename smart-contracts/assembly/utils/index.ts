// function to check teh address validity
export function isValidAddress(address: string): bool {
  return address.length > 50 && address.length < 54 && address.startsWith('AU');
}

// function to check teh address validity
export function isValidSmartContractAddress(address: string): bool {
  return address.length > 50 && address.length < 54 && address.startsWith('AS');
}

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

export function assertIsValidTokenDecimals(decimals: u8): void {
  assert(
    decimals == 9 || decimals == 18,
    'Invalid token decimals. Must be 9 or 18.',
  );
}
