import { ONE_PERCENT } from '../utils/constants';

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
