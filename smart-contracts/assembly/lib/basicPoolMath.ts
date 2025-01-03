import { u256 } from 'as-bignum/assembly';
import { SafeMath256 } from './safeMath';
import { generateEvent, print } from '@massalabs/massa-as-sdk';

export const HUNDRED_PERCENT =u64(1000);

export function getInputAmountNet(inputAmount: u256, feeRate: f64): u256 {
  // Ensure feeRate is within a valid range [0, 1]
  assert(feeRate >= 0.0 && feeRate <= 1.0, 'feeRate should be between 0 and 1');

  print('inputAmount : ' + inputAmount.toString());
  print('Fee rate : ' + feeRate.toString());
  // Convert feeRate to a scaled integer (feeRate)
  const feeRateScaled = f64ToU256(feeRate);

  // Calculate the fee as: (inputAmount * feeRateScaled) / 100
  const fee = SafeMath256.div(
    SafeMath256.mul(inputAmount, feeRateScaled),
    ONE_HUNDRED_PERCENT,
  );

  // Subtract the fee from the input amount
  const inputAmountNet = SafeMath256.sub(inputAmount, fee);

  return inputAmountNet;
}

export function getFeeFromAmount(inputAmount: u256, feeRate: f64): u256 {
  const feeRateScaled = u256.fromF64(feeRate);

  print('inputAmount : ' + inputAmount.toString());

  print('Fee rate : ' + feeRate.toString());
  print('feeRateScaled : ' + feeRateScaled.toString());

  generateEvent(`Fee rate: ${feeRate.toString()}`);
  generateEvent(`Fee rate scaled: ${feeRateScaled.toString()}`);

  generateEvent(`Input amount: ${inputAmount.toString()}`);

  // Calculate the fee as: (inputAmount * feeRateScaled)
  const product = SafeMath256.mul(inputAmount, feeRateScaled);

  // Calculate the fee as: (inputAmount * feeRateScaled) / HUNDRED_PERCENT
  const fee = SafeMath256.div(product, u256.fromU64(HUNDRED_PERCENT));

  print('fee : ' + fee.toString());
  generateEvent(`Fee: ${fee.toString()}`);

  return fee;
}

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
