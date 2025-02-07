import { u256 } from 'as-bignum/assembly';

// Constant for 1%
export const ONE_PERCENT = u64(10_000);

// Native MAS coin address to determine if the token address is the native Mas coin
export const NATIVE_MAS_COIN_ADDRESS = 'NATIVE_COIN';


// scaling factor representing 1 on a 6 decimals precision. This will be used for the fees calculation.
export const SCALING_FACTOR = u256.fromU64(1_000_000);
