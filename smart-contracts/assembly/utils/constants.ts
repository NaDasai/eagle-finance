import { u256 } from 'as-bignum/assembly';

// Constant for 1%
export const ONE_PERCENT = u64(10_000);

// Native MAS coin address to determine if the token address is the native Mas coin
export const NATIVE_MAS_COIN_ADDRESS = 'NATIVE_COIN';

// scaling factor representing 1 on a 6 decimals precision. This will be used for the fees calculation.
export const SCALING_FACTOR = u256.fromU64(1_000_000);

// Minimum liquidity constant used to prevent the first liquidity provider from withdrawing all liquidity
// This creates a minimum reserve in the pool, improving price stability and preventing division by zero
export const MINIMUM_LIQUIDITY = u256.fromU64(1_000);

// Minimum coins required to deploy a token smart contract from the token deployer.Its value is determined by estimating the storage costs.
export const MINIMUM_COINS_TO_DEPLOY_TOKEN = u64(50_000_000);
