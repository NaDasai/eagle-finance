import { u256 } from 'as-bignum/assembly';

// Constant for 1%
export const ONE_PERCENT = u64(10_000);

// Native MAS coin address to determine if the token address is the native Mas coin
export const NATIVE_MAS_COIN_ADDRESS = 'NATIVE_COIN';

// scaling factor representing 1 on a 6 decimals precision. This will be used for the fees calculation.
export const SCALING_FACTOR = u256.fromU64(1_000_000);

// Minimum coins required to deploy a token smart contract from the token deployer.Its value is determined by estimating the storage costs.
export const MINIMUM_COINS_TO_DEPLOY_TOKEN = u64(50_000_000);

// Default route length limit for the swap router
export const DEFAULT_ROUTE_LENGTH_LIMIT: i32 = 4;

// Define the allowed input fees
export const ALLOWED_INPUT_FEES: u64[] = [
  u64(0.01 * f64(ONE_PERCENT)),
  u64(0.05 * f64(ONE_PERCENT)),
  u64(0.3 * f64(ONE_PERCENT)),
  u64(1 * ONE_PERCENT),
];

// Minimum percentage of the first depositor's liquidity that should be locked as minimum liquidity
export const INITIAL_LIQUIDITY_LOCK_PERCENTAGE: u256 =
  u256.fromU64(5); // 5%
