import { u256 } from 'as-bignum/assembly';

export function getInputAmountNet(inputAmount: u256, feeRate: u16): u256 {
  const fee = u256.mul(
    inputAmount,
    u256.div(u256.fromU64(feeRate), u256.fromF64(100)),
  );

  const inputAmountNet = u256.sub(inputAmount, fee);

  return inputAmountNet;
}

export function getOutputAmount(
  inputAmount: u256,
  inputReserve: u256,
  outputReserve: u256,
): u256 {
  const f = u256.mul(outputReserve, inputAmount);
  const f2 = u256.add(inputReserve, inputAmount);

  const returnAmount = u256.div(f, f2);

  return returnAmount;
}
