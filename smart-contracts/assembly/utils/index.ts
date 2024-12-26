import { Args } from '@massalabs/as-types';

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
  wmasAddress: string = 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU',
): string {
  // sort the addresses to ensure that the key of the pool is always the same
  // Ensure WMAS is always tokenB
  if (tokenA === wmasAddress || (tokenB !== wmasAddress && tokenA > tokenB)) {
    const temp = tokenA;
    tokenA = tokenB;
    tokenB = temp;
  }
  const key = `${tokenA}-${tokenB}-${inputFeeRate.toString()}`;
  return key;
}

// Default decimals to be used (9 or 18)
export const DEFAULT_DECIMALS = 9;

// Native MAS coin address to determine if the token address is the native Mas coin
export const NATIVE_MAS_COIN_ADDRESS = 'NATIVE_COIN';

/**
 * Asserts that the token decimals are either 9 or 18.
 * @param decimals - Decimals of the token.
 * @returns void
 * @throws if the token decimals are not 9 or 18.
 */
export function assertIsValidTokenDecimals(decimals: u8): void {
  assert(
    decimals == 6 || decimals == 9 || decimals == 18,
    'Invalid token decimals. Must be 6 or 9 or 18.',
  );
}

/**
 * Serializes an array of strings into a static array of bytes.
 * @param arr - Array of strings to serialize.
 * @returns StaticArray<u8> - Serialized array of bytes.
 */
export function serializeStringArray(arr: string[]): StaticArray<u8> {
  return new Args().add(arr).serialize();
}

/**
 * Deserializes a static array of bytes into an array of strings.
 * @param arr - StaticArray<u8> to deserialize.
 * @returns Array<string> - Deserialized array of strings.
 */
export function deserializeStringArray(arr: StaticArray<u8>): string[] {
  return new Args(arr).nextStringArray().unwrapOrDefault();
}
