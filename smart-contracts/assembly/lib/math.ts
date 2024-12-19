import { print } from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly';
import { SafeMath256 } from './safeMath';

// Utility: Converts f64 to u256 with 18 decimals precision
export function f64ToU256(value: f64, decimals: i32 = 18): u256 {
  // Scale the value to 18 decimals
  const scale = Math.pow(10, decimals) as f64; // 10^18
  const scaledValue = value * scale; // Scale the value

  // Safely cast to u256 (ensure non-negative values)
  if (scaledValue < 0) {
    throw new Error('Negative values are not supported.');
  }

  return u256.fromF64(scaledValue);
}

// Utility: Normalize a number with fewer decimals to 18 decimals
export function normalizeTo18Decimals(value: u256, currentDecimals: i32): u256 {
  assert(currentDecimals >= 0, 'Current decimals must be non-negative.');
  assert(
    currentDecimals <= 18,
    'Current decimals must be less than or equal to 18.',
  );

  const decimalDifference = 18 - currentDecimals;

  // Multiply value by 10^(decimalDifference) to normalize
  if (decimalDifference > 0) {
    print('Decimal Difference: ' + decimalDifference.toString());
    const multiplier = u256.fromU64(u64(10 ** decimalDifference));
    print('Multiplier: ' + multiplier.toString());
    return SafeMath256.mul(value, multiplier);
  }

  return value; // Already 18 decimals
}

// function to check beteen 0 and 1
export function isBetweenZeroAndOne(value: f64): bool {
  return value >= 0 && value <= 1;
}
