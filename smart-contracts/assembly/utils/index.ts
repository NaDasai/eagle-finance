// function to check teh address validity
export function isValidAddress(address: string): bool {
  return address.length == 53 && address.startsWith('AU');
}

// function to check teh address validity
export function isValidSmartContractAddress(address: string): bool {
  return address.length == 52 && address.startsWith('AS');
}

export function _buildPoolKey(
  tokenA: string,
  tokenB: string,
  feeShareProtocol: f64,
): string {
  // sort the addresses to ensure that the key of the pool is always the same
  if (tokenA > tokenB) {
    const temp = tokenA;
    tokenA = tokenB;
    tokenB = temp;
  }
  const key = `${tokenA}-${tokenB}-${feeShareProtocol.toString()}`;
  return key;
}
