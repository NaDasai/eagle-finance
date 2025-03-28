import { u256 } from 'as-bignum/assembly';
import { SafeMath256 } from './safeMath';
import { SCALING_FACTOR } from '../utils/constants';

/**
 * Calculates the fee from a given input amount and fee rate.
 *
 * @param inputAmount - The amount from which the fee is to be calculated, represented as a u256.
 * @param feeRate - The fee rate as a floating-point number.
 * @returns The calculated fee as a u256, derived by multiplying the input amount by the fee rate
 *          and dividing by the SCALING_FACTOR (1,000,000).
 */
export function getFeeFromAmount(inputAmount: u256, feeRate: u64): u256 {
  // convert fee rate to u256
  const feeRate256 = u256.fromU64(feeRate);

  // Calculate the fee as: (inputAmount * feeRate256)
  const product = SafeMath256.mul(inputAmount, feeRate256);

  // Calculate the fee as: (inputAmount * feeRate256) / SCALING_FACTOR (1_000_000)
  const fee = SafeMath256.div(product, SCALING_FACTOR);

  return fee;
}

/**
 * Calculates the amount without fee from a total amount and a fee rate.
 *
 * @param totalAmount - The total amount as a u256 value.
 * @param feeRate - The fee rate as a floating-point number, scaled by SCALING_FACTOR.
 *                  For example, 3000 represents a 0.3% fee.
 * @returns The amount without fee as a u256 value, calculated using the formula:
 *          amountWithoutFee = totalAmount * SCALING_FACTOR / (SCALING_FACTOR + feeRate).
 */
export function getAmountWithoutFee(totalAmount: u256, feeRate: u64): u256 {
  // feeRate is an integer representing the fee rate * SCALING_FACTOR
  // Example: 3000 for 0.3% fee, 5000 for 0.5% fee

  // Calculate the amount without fee using the formula:
  // amountWithoutFee = totalAmount * SCALING_FACTOR / (SCALING_FACTOR + feeRate)

  const feeRateU256 = u256.fromU64(feeRate);
  const denominator = SafeMath256.add(SCALING_FACTOR, feeRateU256);
  const amountWithoutFee = SafeMath256.div(
    SafeMath256.mul(totalAmount, SCALING_FACTOR),
    denominator,
  );

  return amountWithoutFee;
}

/**
 * Calculates the output amount of a swap given an input amount and reserves.
 *
 * @param inputAmount - The amount of input tokens.
 * @param inputReserve - The reserve of input tokens in the pool.
 * @param outputReserve - The reserve of output tokens in the pool.
 * @returns The amount of output tokens received from the swap.
 * @throws Will throw an error if either reserve is zero.
 */
export function getAmountOut(
  inputAmount: u256,
  inputReserve: u256,
  outputReserve: u256,
): u256 {
  assert(
    inputReserve > u256.Zero && outputReserve > u256.Zero,
    'Reserves must be greater than 0',
  );

  // amountOut = (inputAmount * outputReserve) / (inputReserve + inputAmount)
  const f = SafeMath256.mul(outputReserve, inputAmount);
  const f2 = SafeMath256.add(inputReserve, inputAmount);

  const returnAmount = SafeMath256.div(f, f2);

  return returnAmount;
}


