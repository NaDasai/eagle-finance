import { u128, u256 } from 'as-bignum/assembly';

// function to check beteen 0 and 1
export function isBetweenZeroAndOne(value: f64): bool {
  return value >= 0 && value <= 1;
}
