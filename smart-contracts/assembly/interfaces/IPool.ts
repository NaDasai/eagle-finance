import { Args, bytesToU256, u256ToBytes } from '@massalabs/as-types';
import { Address, call } from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly';

export class IPool {
  _origin: Address;

  /**
   * Wraps a registry smart contract address in an interface.
   *
   * @param {Address} _address - Address of the smart contract.
   */
  constructor(_address: Address) {
    this._origin = _address;
  }

  /**
   * Initializes the pool by calling its constructor function.
   *
   * @param {string} aTokenAddress - Address of Token A.
   * @param {string} bTokenAddress - Address of Token B.
   * @param {f64} feeRate - Fee rate for the pool.
   * @param {f64} feeShareProtocol - Protocol fee share.
   * @param {string} registryAddress - Address of the registry contract.
   */
  init(
    aTokenAddress: string,
    bTokenAddress: string,
    feeRate: f64,
    feeShareProtocol: f64,
    registryAddress: string,
  ): void {
    const args = new Args()
      .add(aTokenAddress)
      .add(bTokenAddress)
      .add(feeRate)
      .add(feeShareProtocol)
      .add(registryAddress);
    call(this._origin, 'constructor', args, u64(500000000));
  }
  /**
   * Adds liquidity to the pool.
   *
   * @param {u256} amountA - Amount of Token A.
   * @param {u256} amountB - Amount of Token B.
   */
  addLiquidity(amountA: u256, amountB: u256): void {
    const args = new Args().add(u256ToBytes(amountA)).add(u256ToBytes(amountB));
    call(this._origin, 'addLiquidity', args, 0);
  }

  /**
   * Swaps tokens in the pool.
   *
   * @param {string} tokenInAddress - Address of the input token.
   * @param {u256} amountIn - Amount of the input token.
   */
  swap(tokenInAddress: string, amountIn: u256): void {
    const args = new Args().add(tokenInAddress).add(u256ToBytes(amountIn));
    call(this._origin, 'swap', args, 0);
  }

  /**
   * Claims accumulated protocol fees.
   *
   * @param {string} tokenAddress - Address of the token to claim fees for.
   */
  claimProtocolFees(tokenAddress: string): void {
    const args = new Args().add(tokenAddress);
    call(this._origin, 'claimProtocolFees', args, 0);
  }

  /**
   * Removes liquidity from the pool.
   *
   * @param {u256} lpTokenAmount - Amount of LP tokens to remove.
   */
  removeLiquidity(lpTokenAmount: u256): void {
    const args = new Args().add(u256ToBytes(lpTokenAmount));
    call(this._origin, 'removeLiquidity', args, 0);
  }

  /**
   * Synchronizes the reserves of the pool with current balances.
   * called only by the owner of the registery
   */
  syncReserves(): void {
    call(this._origin, 'syncReserves', new Args(), 0);
  }

  /**
   * Estimates the swap output for a given input amount.
   *
   * @param {string} tokenInAddress - Address of the input token.
   * @param {u256} amountIn - Amount of the input token.
   * @returns {u256} Estimated output amount.
   */
  getSwapOutEstimation(tokenInAddress: string, amountIn: u256): u256 {
    const args = new Args().add(tokenInAddress).add(u256ToBytes(amountIn));
    const result = call(this._origin, 'getSwapOutEstimation', args, 0);
    return bytesToU256(result);
  }
}
