import { u256 } from 'as-bignum/assembly';
import { IBasicPool } from '../interfaces/IBasicPool';

// Define the GetSwapOutResult type
export class GetSwapOutResult {
  constructor(
    public amountOut: u256,
    public tokenOutAddress: string,
    public reserveIn: u256,
    public reserveOut: u256,
    public totalFee: u256,
    public lpFee: u256,
    public protocolFee: u256,
    public amountInAfterFee: u256,
    public normAmountInAfterFee: u256,
    public normReserveIn: u256,
    public normReserveOut: u256,
    public normAmountOut: u256,
    public inDecimals: u32,
    public outDecimals: u32,
  ) {}
}

// Define the GetLiquidityDataResult type
export class GetLiquidityDataResult {
  constructor(
    public liquidity: u256,
    public finalAmountA: u256,
    public finalAmountB: u256,
    public reserveA: u256,
    public reserveB: u256,
    public aTokenAddressStored: string,
    public bTokenAddressStored: string,
    public initialLiquidityLock: u256,
    public isInitialLiquidity: boolean = false,
  ) {}
}

export class addLiquidityData {
  constructor(
    public contractAddress: string,
    public callerAddress: string,
    public finalAmountA: u256,
    public finalAmountB: u256,
    public liquidity: u256,
    public newResA: u256,
    public newResB: u256,
  ) {}
}

export class CreateNewPoolData {
  constructor(
    public poolAddress: string,
    public flashLoanFee: u64,
    public poolContract: IBasicPool,
  ) {}
}
