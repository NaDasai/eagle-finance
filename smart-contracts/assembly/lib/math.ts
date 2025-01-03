import { print } from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly';
import { SafeMath256 } from './safeMath';
import { HUNDRED_PERCENT } from '../utils/constants';

/**
 * Converts a floating-point number to a u256 integer by scaling it to a specified number of decimals.
 *
 * @param value - The floating-point number to be converted.
 * @param decimals - The number of decimal places to scale the value.
 * @returns A u256 integer representation of the scaled value.
 * @throws An error if the scaled value is negative, as negative values are not supported.
 */
export function f64ToU256(value: f64, decimals: i32): u256 {
  // Scale the value to 18 decimals
  const scale = Math.pow(10, decimals) as f64; // 10^18
  const scaledValue = value * scale; // Scale the value

  // Safely cast to u256 (ensure non-negative values)
  if (scaledValue < 0) {
    throw new Error('Negative values are not supported.');
  }

  return u256.fromF64(scaledValue);
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
  currentDecimals: i32,
  toDecimals: i32,
): u256 {
  assert(currentDecimals >= 0, 'Current decimals must be non-negative.');
  assert(toDecimals >= 0, 'To decimals must be non-negative.');
  assert(
    currentDecimals <= 18,
    'Current decimals must be less than or equal to 18.',
  );
  assert(toDecimals <= 18, 'To decimals must be less than or equal to 18.');

  const decimalDifference = toDecimals - currentDecimals;

  // Multiply value by 10^(decimalDifference) to normalize
  if (decimalDifference > 0) {
    print('Decimal Difference: ' + decimalDifference.toString());
    const multiplier = u256.fromU64(u64(10 ** decimalDifference));
    print('Multiplier: ' + multiplier.toString());
    return SafeMath256.mul(value, multiplier);
  } else if (decimalDifference < 0) {
    // Divide value by 10^(decimalDifference) to normalize
    print('Decimal Difference: ' + decimalDifference.toString());
    const divisor = u256.fromU64(u64(10 ** -decimalDifference));
    print('Divisor: ' + divisor.toString());
    return SafeMath256.div(value, divisor);
  }

  return value; // Already default decimals
}

/**
 * Checks if a given floating-point value is between 0 and 10 percent.
 * Used to check if the value is a valid fee.
 * Fees will be divided by 1000 to get the actual fee.
 * @param value - The floating-point number to evaluate.
 * @returns A boolean indicating whether the value is greater than 0 and less than or equal to 10 percent.
 */
export function isBetweenZeroAndTenPercent(value: f64): bool {
  return value > 0 && value <= 10 * f64(HUNDRED_PERCENT);
}
