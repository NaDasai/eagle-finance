// This contract is used for testing purposes and is not intended to be used in production.
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

  generateEvent(`FLASH_SWAP_CONTRACT: Flash swap contract called with amountA: ${amountA}, amountB: ${amountB},
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

    // amountToRepay = amountA + aAmountFee
    const amountToRepay = amountA + aAmountFee;

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

    // init FlashLoan again (this is malicious)
    const poolContract = new IBasicPool(new Address(poolAddress));

    poolContract.flashLoan(amountA, amountB, sender, data);

    // TRnasfer amountToRepay to the contract
    tokenA.transfer(new Address(poolAddress), amountToRepay);

    if (profit) {
      // transfer the profit to the sender
      tokenA.transfer(new Address(sender), profit);
    }

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

    // call swap from the same poolCntract
    const poolContract = new IBasicPool(new Address(poolAddress));

    poolContract.swap(
      tokenAAddress,
      amountB,
      u256.fromU64(0),
      Context.caller(),
    );

    // TRnasfer amountToRepay to the contract
    tokenB.transfer(new Address(poolAddress), amountToRepay);

    if (profit) {
      // transfer the profit to the sender
      tokenB.transfer(new Address(sender), profit);
    }

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

/**
 * Initializes a flash loan operation using the provided binary arguments.
 *
 * @param binaryArgs - A serialized array of bytes containing the necessary arguments for the flash loan.
 *  - aAmount: The amount of aTokens to loan.
 *  - bAmount: The amount of bTokens to loan.
 *  - profitAddress: The address of the profit destination.
 *  - data: Additional data to be passed to the flash loan.
 *
 *
 * @remarks
 * This function deserializes the binary arguments to extract the profit address,
 * amounts for two assets (aAmount and bAmount), and additional data. It retrieves
 * the pool address from storage and initiates a flash loan operation on the pool
 * contract with the specified parameters.
 *
 * @throws Will throw an error if any of the required arguments are missing or invalid.
 */
export function initFlash(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const aAmount = args.nextU256().expect('aAmount is missing or invalid');
  const bAmount = args.nextU256().expect('bAmount is missing or invalid');

  const profitAddress = args
    .nextString()
    .expect('profitAddress is missing or invalid');

  const data = args.nextBytes().expect('data is missing or invalid');

  // Get the pool address from storage
  const poolAddress = bytesToString(Storage.get(poolAddressKey));

  const poolContract = new IBasicPool(new Address(poolAddress));

  poolContract.flashLoan(aAmount, bAmount, profitAddress, data);
}

// Export ownership functions
export * from '../../utils/ownership';
