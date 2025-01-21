import { u256 } from 'as-bignum/assembly';
import { SafeMath256 } from './safeMath';
import { ONE_PERCENT, SCALING_FACTOR } from '../utils/constants';
import { print } from '@massalabs/massa-as-sdk';

export function getFeeFromAmount(inputAmount: u256, feeRate: f64): u256 {
  // convert fee rate to u256
  const feeRate256 = u256.fromF64(feeRate);

  // Calculate the fee as: (inputAmount * feeRate256)
  const product = SafeMath256.mul(inputAmount, feeRate256);

  // Calculate the fee as: (inputAmount * feeRate256) / SCALING_FACTOR (1_000_000)
  const fee = SafeMath256.div(product, SCALING_FACTOR);

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
