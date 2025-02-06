import {
  Args,
  bytesToF64,
  bytesToString,
  bytesToU256,
  bytesToU64,
  byteToBool,
  u256ToBytes,
} from '@massalabs/as-types';
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
   * @param {f64} feeRate - Fee rate for the pool.
   * @param {f64} feeShareProtocol - Protocol fee share.
   * @param {string} registryAddress - Address of the registry contract.
   */
  init(
    aTokenAddress: string,
    bTokenAddress: string,
    feeRate: f64,
    feeShareProtocol: f64,
    flashLoanFee: f64,
    registryAddress: string,
  ): void {
    const args = new Args()
      .add(aTokenAddress)
      .add(bTokenAddress)
      .add(feeRate)
      .add(feeShareProtocol)
      .add(flashLoanFee)
      .add(registryAddress);
    call(this._origin, 'constructor', args, u64(100000000));
  }

  /**
   * Adds liquidity to the pool.
   *
   * @param {u256} amountA - Amount of Token A.
   * @param {u256} amountB - Amount of Token B.
   * @param {u256} minAmountA - Minimum amount of Token A to receive.
   * @param {u256} minAmountB - Minimum amount of Token B to receive.
   */
  addLiquidity(
    amountA: u256,
    amountB: u256,
    minAmountA: u256,
    minAmountB: u256,
  ): void {
    const args = new Args()
      .add(amountA)
      .add(amountB)
      .add(minAmountA)
      .add(minAmountB);
    call(this._origin, 'addLiquidity', args, 0);
  }

  addLiquidityFromRegistry(
    callerAddress: Address,
    amountA: u256,
    amountB: u256,
    minAmountA: u256,
    minAmountB: u256,
    isNativeCoin: bool = false,
    coins: u64 = 0,
  ): void {
    const args = new Args()
      .add(callerAddress)
      .add(amountA)
      .add(amountB)
      .add(minAmountA)
      .add(minAmountB)
      .add(isNativeCoin);
    call(this._origin, 'addLiquidityFromRegistry', args, coins);
  }

  /**
   * Swaps tokens in the pool.
   *
   * @param {string} tokenInAddress - Address of the input token.
   * @param {u256} amountIn - Amount of the input token.
   */
  swap(tokenInAddress: string, amountIn: u256): void {
    const args = new Args().add(tokenInAddress).add(amountIn);
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
   * @param {u256} minAmountA - Minimum amount of Token A to receive.
   * @param {u256} minAmountB - Minimum amount of Token B to receive.
   */
  removeLiquidity(
    lpTokenAmount: u256,
    minAmountA: u256,
    minAmountB: u256,
  ): void {
    const args = new Args().add(lpTokenAmount).add(minAmountA).add(minAmountB);
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
    const args = new Args().add(tokenInAddress).add(amountIn);
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

  /**
   * Retrieves the address of the A token.
   * @returns {string} The address of the A token.
   */
  getATokenAddress(): string {
    const result = call(this._origin, 'getATokenAddress', new Args(), 0);
    return bytesToString(result);
  }

  /**
   * Retrieves the address of the B token.
   * @returns {string} The address of the B token.
   */
  getBTokenAddress(): string {
    const result = call(this._origin, 'getBTokenAddress', new Args(), 0);
    return bytesToString(result);
  }

  /**
   * Retrieves the fee rate.
   * @returns {f64} The fee rate as a f64.
   */
  getFeeRate(): f64 {
    const result = call(this._origin, 'getFeeRate', new Args(), 0);
    return bytesToF64(result);
  }

  /**
   * Retrieves the flash loan fee.
   * @returns {f64} The flash loan fee as a f64.
   */
  getFlashLoanFee(): f64 {
    const result = call(this._origin, 'getFlashLoanFee', new Args(), 0);
    return bytesToF64(result);
  }

  /**
   * Retrieves the cumulative price of token A in terms of token B.
   * @returns {u256} The cumulative price of token A in terms of token B, as a u256 represented as a fraction.
   */
  getAPriceCumulativeLast(): u256 {
    const result = call(this._origin, 'getAPriceCumulativeLast', new Args(), 0);
    return bytesToU256(result);
  }

  /**
   * Retrieves the cumulative price of token B in terms of token A.
   * @returns {u256} The cumulative price of token B in terms of token A, as a u256 represented as a fraction.
   */
  getBPriceCumulativeLast(): u256 {
    const result = call(this._origin, 'getBPriceCumulativeLast', new Args(), 0);
    return bytesToU256(result);
  }

  /**
   * Retrieves the timestamp of the last update.
   * @returns {u64} The timestamp of the last update.
   */
  getLastTimestamp(): u64 {
    const result = call(this._origin, 'getLastTimestamp', new Args(), 0);
    return bytesToU64(result);
  }

  /**
   * Executes a flash loan, borrowing the specified amounts of tokens A and B, and calling the provided callback function.
   *
   * @param {u256} aAmount - The amount of token A to borrow.
   * @param {u256} bAmount - The amount of token B to borrow.
   * @param {string} profitAddress - The address to receive any profit from the flash loan.
   * @param {StaticArray<u8>} callbackData - Additional data to pass to the callback function.
   */
  flashLoan(
    aAmount: u256,
    bAmount: u256,
    profitAddress: string,
    callbackData: StaticArray<u8>,
  ): void {
    const args = new Args()
      .add(aAmount)
      .add(bAmount)
      .add(profitAddress)
      .add(callbackData);
    call(this._origin, 'flashLoan', args, 0);
  }

  /**
   * Estimates the liquidity pool (LP) tokens to be received when adding liquidity.
   *
   * @param {u256} amountA - The amount of token A to add.
   * @param {u256} amountB - The amount of token B to add.
   * @returns {u256} The estimated amount of LP tokens.
   */
  getAddLiquidityLPEstimation(amountA: u256, amountB: u256): u256 {
    const args = new Args().add(amountA).add(amountB);
    const result = call(this._origin, 'getAddLiquidityLPEstimation', args, 0);
    return bytesToU256(result);
  }

  /**
   * Adds liquidity to the pool using MAS tokens.
   *
   * @param {u256} amountA - The amount of token A to add to the pool.
   * @param {u256} amountB - The amount of token B to add to the pool.
   * @param {u256} minAmountA - The minimum amount of token A to add to the pool.
   * @param {u256} minAmountB - The minimum amount of token B to add to the pool.
   */
  addLiquidityWithMas(
    amountA: u256,
    amountB: u256,
    minAmountA: u256,
    minAmountB: u256,
  ): void {
    const args = new Args()
      .add(amountA)
      .add(amountB)
      .add(minAmountA)
      .add(minAmountB);
    call(this._origin, 'addLiquidityWithMas', args, 0);
  }

  /**
   *  Swaps Mas with the other token in the pool.
   *
   * @param {string} tokenInAddress - The address of the token to swap in.
   * @param {u256} amountIn - The amount of tokenIn to swap.
   * @param {u256} minAmountOut - The minimum amount of tokenOut.
   */
  swapWithMas(
    tokenInAddress: string,
    amountIn: u256,
    minAmountOut: u256,
  ): void {
    const args = new Args().add(tokenInAddress).add(amountIn).add(minAmountOut);
    call(this._origin, 'swapWithMas', args, 0);
  }

  /**
   * Gets the current claimable protocol fee for token A in the basic pool.
   * @returns {u256} The claimable protocol fee for token A.
   */
  getAClaimableProtocolFee(): u256 {
    const result = call(
      this._origin,
      'getAClaimableProtocolFee',
      new Args(),
      0,
    );
    return bytesToU256(result);
  }

  /**
   * Gets the current claimable protocol fee for token B in the basic pool.
   * @returns {u256} The claimable protocol fee for token B.
   */
  getBClaimableProtocolFee(): u256 {
    const result = call(
      this._origin,
      'getBClaimableProtocolFee',
      new Args(),
      0,
    );
    return bytesToU256(result);
  }

  /**
   * Retrieves the total supply of liquidity pool token.
   *
   * @returns {u256} The total supply of liquidity pool token.
   */
  getLPTotalSupply(): u256 {
    const result = call(this._origin, 'getLPTotalSupply', new Args(), 0);
    return bytesToU256(result);
  }

  /**
   * Transfers ownership of the basic pool contract.
   *
   * @param {string} newOwner - Address of the new owner.
   */
  transferOwnership(newOwner: string): void {
    const args = new Args().add(newOwner);
    call(this._origin, 'transferOwnership', args, 0);
  }

  /**
   * Gets the owner of the basic pool contract.
   *
   * @returns {string} The owner's address.
   */
  owner(): string {
    return bytesToString(call(this._origin, 'owner', new Args(), 0));
  }

  /**
   * Checks if the caller is the owner of the contract.
   *
   * @returns {bool} True if the caller is the owner, otherwise false.
   */
  isOwner(address: string): bool {
    const args = new Args().add(address);
    return byteToBool(call(this._origin, 'isOwner', args, 0));
  }

  /**
   * modifier to check if the caller is the owner of the contract.
   *  Throws an error if the caller is not the owner.
   */
  onlyOwner(): void {
    call(this._origin, 'onlyOwner', new Args(), 0);
  }
}
