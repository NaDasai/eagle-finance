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
import { IMRC20 } from '../../interfaces/IMRC20';
import { IEagleCallee } from '../../interfaces/IEagleCallee';
import { IBasicPool } from '../../interfaces/IBasicPool';
import { IRegistery } from '../../interfaces/IRegistry';
import { NATIVE_MAS_COIN_ADDRESS } from '../../utils/constants';
import { SafeMath256 } from '../../lib/safeMath';
import { u256 } from 'as-bignum/assembly';
import { getFeeFromAmount } from '../../lib/basicPoolMath';

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
 * @param binaryArgs - The arguments passed to the function.
 * - `sender`: The address that initiated the flash swap.
 * - `amountA`: The amount of token A borrowed.
 * - `amountB`: The amount of token B borrowed.
 * - `data`: Additional data passed by the caller.
 * @returns void
 */
export function eagleCall(binaryArgs: StaticArray<u8>): void {
  const binArgs = new Args(binaryArgs);

  const sender = binArgs.nextString().expect('Sender is missing or invalid');

  let amountA = binArgs.nextU256().expect('Amount A is missing or invalid');
  let amountB = binArgs.nextU256().expect('Amount B is missing or invalid');
  let data = binArgs.nextBytes().expect('Data is missing or invalid');

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

  // Decode the minAmountOut from the data
  const args = new Args(data);

  const minAmountOut = args
    .nextU256()
    .expect('minAmountOut is missing or invalid');

  generateEvent(`FLASH_SWAP_CONTRACT: Flash swap contract called with amountA: ${amountA}, amountB: ${amountB},
          minAmountOut: ${minAmountOut},
          tokenAAddress: ${tokenAAddress},
          tokenBAddress: ${tokenBAddress},
          poolFeeRate: ${poolFeeRate},
          contractAddress: ${contractAddress},
          wmasTokenAddress: ${wmasTokenAddress}`);

  // Perform the swap on the V1 exchange
  if (amountA > u256.Zero) {
    const aAmountWithProfit = SafeMath256.add(
      amountA,
      u256.fromU64(1000000000),
    );

    const aAmountFee = getFeeFromAmount(amountA, poolFeeRate);

    const amountToRepay = SafeMath256.add(amountA, aAmountFee);

    assert(
      aAmountWithProfit > amountToRepay,
      'FLASH_SWAP_ERROR: Not enough profit to repay',
    );

    const profit = SafeMath256.sub(aAmountWithProfit, amountToRepay);

    const contractATokenBalance = tokenA.balanceOf(contractAddress);

    assert(
      contractATokenBalance >= aAmountWithProfit,
      'FLASH_SWAP_ERROR: Not enough balance',
    );

    // Transfer all the amount to the caller instead of repaying it back to the pool
    tokenA.transfer(new Address(sender), aAmountWithProfit);

    generateEvent(
      `FLASH_SWAP_CONTRACT:  profit: ${aAmountWithProfit}, sender: ${sender}`,
    );
  } else if (amountB > u256.Zero) {
    const bAmountWithProfit = SafeMath256.add(
      amountB,
      u256.fromU64(1000000000),
    );

    const bAmountFee = getFeeFromAmount(amountB, poolFeeRate);

    const amountToRepay = SafeMath256.add(amountB, bAmountFee);

    assert(
      bAmountWithProfit > amountToRepay,
      'FLASH_SWAP_ERROR: Not enough profit to repay',
    );

    const profit = SafeMath256.sub(bAmountWithProfit, amountToRepay);

    const contractBTokenBalance = tokenA.balanceOf(contractAddress);

    assert(
      contractBTokenBalance >= bAmountWithProfit,
      'FLASH_SWAP_ERROR: Not enough balance',
    );

    // Transfer all the amount to the caller instead of repaying it back to the pool
    tokenB.transfer(new Address(sender), bAmountWithProfit);

    generateEvent(
      `FLASH_SWAP_CONTRACT: profit: ${bAmountWithProfit}, sender: ${sender}`,
    );
  } else {
    // If both amountA and amountB are 0, it means something went wrong
    generateEvent('FLASH_SWAP_ERROR: Both amountA and amountB are 0');
    return;
  }
  generateEvent('FLASH_SWAP_SUCCESS: Flash swap completed successfully');
}

// Export ownership functions
export * from '../../utils/ownership';
