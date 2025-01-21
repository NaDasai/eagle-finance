// ExampleFlashSwap.ts
import {
  Address,
  Context,
  generateEvent,
  Storage,
  assertIsSmartContract,
  balance,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  bytesToString,
  stringToBytes,
  u256ToBytes,
  bytesToU256,
  u64ToBytes,
} from '@massalabs/as-types';
import { IMRC20 } from '../interfaces/IMRC20';
import { IEagleCallee } from '../interfaces/IEagleCallee';
import { IBasicPool } from '../interfaces/IBasicPool';
import { IRegistery } from '../interfaces/IRegistry';
import { NATIVE_MAS_COIN_ADDRESS } from '../utils/constants';
import { SafeMath256 } from '../lib/safeMath';
import { u256 } from 'as-bignum/assembly';

// Storage key for the pool address
const poolAddressKey = stringToBytes('poolAddress');
// Storage key for the registry address
const registryAddressKey = stringToBytes('registryAddress');

/**
 * Constructor function that sets the pool and registry addresses.
 * @param binaryArgs - Serialized arguments containing the pool and registry addresses.
 */
export function constructor(binaryArgs: StaticArray<u8>): void {
  // This line is important. It ensures that this function can't be called in the future.
  // If you remove this check, someone could call your constructor function and reset your smart contract.
  assert(Context.isDeployingContract());

  const args = new Args(binaryArgs);
  const poolAddress = args
    .nextString()
    .expect('Pool address is missing or invalid');
  const registryAddress = args
    .nextString()
    .expect('Registry address is missing or invalid');

  // Store the pool address
  Storage.set(poolAddressKey, stringToBytes(poolAddress));
  // Store the registry address
  Storage.set(registryAddressKey, stringToBytes(registryAddress));

  generateEvent(
    `ExampleFlashSwap contract deployed. Pool: ${poolAddress}, Registry: ${registryAddress}`,
  );
}

/**
 * This function is called by the pool contract during a flash swap.
 * @param sender - The address that initiated the flash swap.
 * @param amountA - The amount of token A borrowed.
 * @param amountB - The amount of token B borrowed.
 * @param data - Additional data passed by the caller.
 */
export function eagleCall(
  sender: Address,
  amountA: u256,
  amountB: u256,
  data: StaticArray<u8>,
): void {
  // Get the pool address from storage
  const poolAddress = bytesToString(Storage.get(poolAddressKey));
  // Get the registry address from storage
  const registryAddress = bytesToString(Storage.get(registryAddressKey));

  // Ensure that the sender is actually the pool contract
  assert(
    Context.caller().toString() === poolAddress,
    'FLASH_SWAP_ERROR:  Caller is not the pool contract',
  );

  // Get the pool contract instance
  const pool = new IBasicPool(new Address(poolAddress));

  // Get the registry contract instance
  const registry = new IRegistery(new Address(registryAddress));

  // Get the wmas token address
  const wmasTokenAddress = registry.getWmasTokenAddress();

  // Get token addresses from the pool
  const tokenAAddress = pool.getATokenAddress();
  const tokenBAddress = pool.getBTokenAddress();
  const poolFeeRate = pool.getFeeRate();

  // Get the contract address
  const contractAddress = Context.callee();

  // Get the contract balances for token A and B
  const tokenA = new IMRC20(new Address(tokenAAddress));
  const tokenB = new IMRC20(new Address(tokenBAddress));

  const tokenABalance = tokenA.balanceOf(contractAddress);
  const tokenBBalance = tokenB.balanceOf(contractAddress);

  // Decode the minAmountOut from the data
  const args = new Args(data);

  const minAmountOut = args
    .nextU256()
    .expect('minAmountOut is missing or invalid');

  // Perform the swap on the V1 exchange
  if (amountA > u256.Zero) {
    // If amountA is greater than 0, it means we borrowed token A
    _swapOnOtherExchange(
      tokenAAddress,
      tokenBAddress,
      amountA,
      minAmountOut,
      sender,
      poolFeeRate,
    );
  } else if (amountB > u256.Zero) {
    // If amountB is greater than 0, it means we borrowed token B
    _swapOnOtherExchange(
      tokenBAddress,
      tokenAAddress,
      amountB,
      minAmountOut,
      sender,
      poolFeeRate,
    );
  } else {
    // If both amountA and amountB are 0, it means something went wrong
    generateEvent('FLASH_SWAP_ERROR: Both amountA and amountB are 0');
    return;
  }
  generateEvent('FLASH_SWAP_SUCCESS: Flash swap completed successfully');
}

/**
 * Swaps tokens on a hypothetical V1 exchange.
 * @param tokenInAddress - The address of the token to swap in.
 * @param tokenOutAddress - The address of the token to swap out.
 * @param amountIn - The amount of the token to swap in.
 * @param minAmountOut - The minimum amount of the token to swap out.
 * @param sender - The address that initiated the flash swap.
 * @param feeRate - The fee rate to apply to the swap.
 */
function _swapOnOtherExchange(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: u256,
  minAmountOut: u256,
  sender: Address,
  feeRate: f64,
): void {
  // Get the contract address
  const contractAddress = Context.callee();

  // Get the token instances
  const tokenIn = new IMRC20(new Address(tokenInAddress));
  const tokenOut = new IMRC20(new Address(tokenOutAddress));

  // Get the amount of tokenOut to swap
  let amountOut: u256;

  // we just simulate the other exchange by returning the amountIn + 2 for simplicity
  amountOut = amountIn + u256.fromU64(2);

  // Ensure that the amountOut is greater than or equal to minAmountOut
  assert(
    amountOut >= minAmountOut,
    'FLASH_SWAP_ERROR: minAmountOut not reached',
  );

  // Calculate the amount to return to the pool (amountIn + fee)
  const amountToRepay = SafeMath256.add(
    amountIn,
    SafeMath256.mul(amountIn, u256.fromF64(feeRate / 1000)),
  );

  // Transfer the amountToRepay of tokenIn back to the pool
  tokenIn.transfer(
    new Address(bytesToString(Storage.get(poolAddressKey))),
    amountToRepay,
  );

  // Calculate the profit
  const profit = SafeMath256.sub(amountOut, amountToRepay);

  // Transfer the profit to the sender
  if (profit > u256.Zero) {
    tokenOut.transfer(sender, profit);
  }

  generateEvent(
    `FLASH_SWAP_V1: Swapped ${amountIn.toString()} of ${tokenInAddress} for ${amountOut.toString()} of ${tokenOutAddress}. Profit: ${profit.toString()}`,
  );
}

// Export ownership functions
export * from '../utils/ownership';
