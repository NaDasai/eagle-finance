import { u256 } from 'as-bignum/assembly';

export function getInputAmountNet(inputAmount: u256, feeRate: f64): u256 {
  // Ensure feeRate is within a valid range [0, 1]
  assert(feeRate >= 0.0 && feeRate <= 1.0, 'feeRate should be between 0 and 1');

  // Convert feeRate to a scaled integer (feeRate)
  const feeRateScaled = u256.fromF64(feeRate);

  // Calculate the fee as: (inputAmount * feeRateScaled)
  const fee = u256.mul(inputAmount, feeRateScaled);

  // Subtract the fee from the input amount
  const inputAmountNet = u256.sub(inputAmount, fee);

  return inputAmountNet;
}

export function getAmountOut(
  inputAmount: u256,
  inputReserve: u256,
  outputReserve: u256,
): u256 {
  // amountOut = (inputAmount * outputReserve) / (inputReserve + inputAmount)
  const f = u256.mul(outputReserve, inputAmount);
  const f2 = u256.add(inputReserve, inputAmount);

  const returnAmount = u256.div(f, f2);

  return returnAmount;
}
