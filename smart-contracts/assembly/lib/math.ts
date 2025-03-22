import { ONE_PERCENT } from '../utils/constants';
import { u256 } from 'as-bignum/assembly';
import { SafeMath256 } from './safeMath';

/**
 * Checks if a given floating-point value is between 0 and 10 percent.
 * Used to check if the value is a valid fee.
 * Fees will be divided by 1000 to get the actual fee.
 * @param value - The floating-point number to evaluate.
 * @returns A boolean indicating whether the value is greater than 0 and less than or equal to 10 percent.
 */
export function isBetweenZeroAndTenPercent(value: u64): bool {
  return value >= 0 && value <= 10 * u64(ONE_PERCENT);
}

export function isBetweenZeroAndThirtyPercent(value: u64): bool {
  return value >= 0 && value <= 30 * ONE_PERCENT;
}

/**
 * Normalizes a given `u256` value to a specified number of decimals.
 *
 * This function adjusts the decimal places of the input value from its current
 * decimal setting to a target decimal setting. It ensures that both the current
 * and target decimals are non-negative and do not exceed 18. If the target
 * decimals are greater than the current, the value is multiplied by 10 raised
 * to the power of the difference. If the target decimals are less, the value
 * is divided by 10 raised to the power of the difference.
 *
 * @param value - The `u256` value to be normalized.
 * @param currentDecimals - The current number of decimal places of the value.
 * @param toDecimals - The target number of decimal places for normalization.
 * @returns The normalized `u256` value with the specified number of decimals.
 * @throws Will throw an error if the current or target decimals are negative
 * or exceed 18.
 */
export function normalizeToDecimals(
  value: u256,
  currentDecimals: u32,
  toDecimals: u32 = 18,
): u256 {
  assert(
    currentDecimals > 0 && currentDecimals <= toDecimals,
    'CURRENT_DECIMALS_OUT_OF_RANGE',
  );

  assert(toDecimals > 0 && toDecimals <= 18, 'TO_DECIMALS_OUT_OF_RANGE');

  const difference: i32 = toDecimals - currentDecimals;

  // If the difference is zero, the value is already normalized.
  if (difference == 0) {
    return value;
  }

  if (difference > 0) {
    const multiplier = u256.from(10 ** difference);
    return SafeMath256.mul(value, multiplier);
  } else {
    const divider = u256.from(10 ** -difference);
    return SafeMath256.div(value, divider);
  }
}

/**
 * Denormalizes a given `u256` normalized value from a target decimal (default: 18)
 * to the token's native decimal places.
 *
 * @param value - The normalized `u256` value to be denormalized.
 * @param tokenDecimals - The token's native number of decimal places.
 * @param fromDecimals - The current number of decimals of the normalized value (default: 18).
 * @returns The denormalized `u256` value with the token's native decimals.
 * @throws Will throw an error if the token decimals or fromDecimals are out of expected range.
 */
export function denormalizeFromDecimals(
  value: u256,
  tokenDecimals: u32,
  fromDecimals: u32 = 18,
): u256 {
  // Ensure that fromDecimals and tokenDecimals are within expected ranges.
  assert(fromDecimals > 0 && fromDecimals <= 18, 'FROM_DECIMALS_OUT_OF_RANGE');
  assert(
    tokenDecimals > 0 && tokenDecimals <= fromDecimals,
    'TOKEN_DECIMALS_OUT_OF_RANGE',
  );

  const difference: i32 = fromDecimals - tokenDecimals;

  // If there is no difference, the value is already denormalized.
  if (difference == 0) {
    return value;
  }

  // For tokens with fewer decimals, we scale down by dividing.
  const divider = u256.from(10 ** difference);
  return SafeMath256.div(value, divider);
}
