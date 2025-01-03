import { u256 } from 'as-bignum/assembly';
import { SafeMath256 } from './safeMath';
import { generateEvent, print } from '@massalabs/massa-as-sdk';
import { HUNDRED_PERCENT } from '../utils/constants';

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
