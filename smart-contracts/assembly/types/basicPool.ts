import { u256 } from 'as-bignum/assembly';

// Define the GetSwapOutResult type
export class GetSwapOutResult {
  amountOut: u256;
  tokenOutAddress: string;
  reserveIn: u256;
  reserveOut: u256;
  totalFee: u256;
  lpFee: u256;
  protocolFee: u256;
  amountInAfterFee: u256;

  constructor(
    amountOut: u256,
    tokenOutAddress: string,
    reserveIn: u256,
    reserveOut: u256,
    totalFee: u256,
    lpFee: u256,
    protocolFee: u256,
    amountInAfterFee: u256,
  ) {
    this.amountOut = amountOut;
    this.tokenOutAddress = tokenOutAddress;
    this.reserveIn = reserveIn;
    this.reserveOut = reserveOut;
    this.totalFee = totalFee;
    this.lpFee = lpFee;
    this.protocolFee = protocolFee;
    this.amountInAfterFee = amountInAfterFee;
  }
}

// Define the GetLiquidityDataResult type
export class GetLiquidityDataResult {
  liquidity: u256;
  finalAmountA: u256;
  finalAmountB: u256;
  reserveA: u256;
  reserveB: u256;
  aTokenAddressStored: string;
  bTokenAddressStored: string;

  constructor(
    liquidity: u256,
    finalAmountA: u256,
    finalAmountB: u256,
    reserveA: u256,
    reserveB: u256,
    aTokenAddressStored: string,
    bTokenAddressStored: string,
  ) {
    this.liquidity = liquidity;
    this.finalAmountA = finalAmountA;
    this.finalAmountB = finalAmountB;
    this.reserveA = reserveA;
    this.reserveB = reserveB;
    this.aTokenAddressStored = aTokenAddressStored;
    this.bTokenAddressStored = bTokenAddressStored;
  }
}
