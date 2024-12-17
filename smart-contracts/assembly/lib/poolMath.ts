import { u256 } from 'as-bignum/assembly';
import { SafeMath256 } from './safeMath';
import { print } from '@massalabs/massa-as-sdk';

export function getInputAmountNet(inputAmount: u256, feeRate: f64): u256 {
  // Ensure feeRate is within a valid range [0, 1]
  assert(feeRate >= 0.0 && feeRate <= 1.0, 'feeRate should be between 0 and 1');

  print('inputAmount : ' + inputAmount.toString());
  print('Fee rate : ' + feeRate.toString());
  // Convert feeRate to a scaled integer (feeRate)
  const feeRateScaled = u256.fromF64(feeRate);

  // Calculate the fee as: (inputAmount * feeRateScaled)
  const fee = SafeMath256.mul(inputAmount, feeRateScaled);

  // Subtract the fee from the input amount
  const inputAmountNet = SafeMath256.sub(inputAmount, fee);

  return inputAmountNet;
}

export function getFeeFromAmount(inputAmount: u256, feeRate: f64): u256 {
  // Ensure feeRate is within a valid range [0, 1]
  assert(feeRate >= 0.0 && feeRate <= 1.0, 'feeRate should be between 0 and 1');

  print('inputAmount : ' + inputAmount.toString());

  print('Fee rate : ' + feeRate.toString());
  // Convert feeRate to a scaled integer (feeRate)
  const feeRateScaled = u256.fromF64(feeRate);

  print('Fee rate scaled : ' + feeRateScaled.toString());

  // Calculate the fee as: (inputAmount * feeRateScaled)
  const fee = SafeMath256.mul(inputAmount, feeRateScaled);

  print('fee : ' + fee.toString());

  return fee;
}

export function getAmountOut(
  inputAmount: u256,
  inputReserve: u256,
  outputReserve: u256,
): u256 {
  // amountOut = (inputAmount * outputReserve) / (inputReserve + inputAmount)
  const f = SafeMath256.mul(outputReserve, inputAmount);
  const f2 = SafeMath256.add(inputReserve, inputAmount);

  const returnAmount = SafeMath256.div(f, f2);

  return returnAmount;
}
