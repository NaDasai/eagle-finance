import { Args, bytesToU256, u256ToBytes } from '@massalabs/as-types';
import { Address, call } from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly';

export class IBasicPool {
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
   * @param {u8} aTokenDecimals - Decimals of Token A.
   * @param {u8} bTokenDecimals - Decimals of Token B.
   * @param {f64} feeRate - Fee rate for the pool.
   * @param {f64} feeShareProtocol - Protocol fee share.
   * @param {string} registryAddress - Address of the registry contract.
   */
  init(
    aTokenAddress: string,
    bTokenAddress: string,
    aTokenDecimals: u8,
    bTokenDecimals: u8,
    feeRate: f64,
    feeShareProtocol: f64,
    registryAddress: string,
  ): void {
    const args = new Args()
      .add(aTokenAddress)
      .add(bTokenAddress)
      .add(aTokenDecimals)
      .add(bTokenDecimals)
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
   */
  claimProtocolFees(): void {
    call(this._origin, 'claimProtocolFees', new Args(), 0);
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

  /**
   * Retrieves the balance of the LP token for a given user.
   * @param {string} userAddress - Address of the user.
   * @returns {u256}  balance - The balance of the LP token for the given user.
   */
  getLPBalance(userAddress: string): u256 {
    const args = new Args().add(userAddress);
    const result = call(this._origin, 'getLPBalance', args, 0);
    return bytesToU256(result);
  }

  /**
   * Retrieves the local reserve of token A.
   * @returns {u256} The current reserve of token A in the pool.
   */
  getLocalReserveA(): u256 {
    const result = call(this._origin, 'getLocalReserveA', new Args(), 0);
    return bytesToU256(result);
  }

  /**
   * Retrieves the local reserve of token B.
   * @returns {u256} The current reserve of token B in the pool.
   */
  getLocalReserveB(): u256 {
    const result = call(this._origin, 'getLocalReserveB', new Args(), 0);
    return bytesToU256(result);
  }

  /**
   * Retrieves the price of Token A in terms of Token B.
   * @returns {u256}  The price of token A in terms of token B, as a u256 represented as a fraction.
   */
  getPrice(): u256 {
    const result = call(this._origin, 'getPrice', new Args(), 0);
    return bytesToU256(result);
  }
}
