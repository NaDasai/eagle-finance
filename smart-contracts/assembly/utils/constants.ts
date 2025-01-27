import { u256 } from 'as-bignum/assembly';

// Constant for 100%
export const ONE_PERCENT = u64(10_000);

// Native MAS coin address to determine if the token address is the native Mas coin
export const NATIVE_MAS_COIN_ADDRESS = 'NATIVE_COIN';

export const DEFAULT_BUILDNET_WMAS_ADDRESS =
  'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';

// scaling factor representing 1 on a 6 decimals precision. This will be used for the fees calculation.
export const SCALING_FACTOR = u256.fromU64(1_000_000);
