import {
  Context,
  createSC,
  generateEvent,
  Storage,
  fileToByteArray,
  Address,
  validateAddress,
  assertIsSmartContract,
  balance,
  createEvent,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  boolToByte,
  bytesToU64,
  bytesToString,
  u64ToBytes,
  stringToBytes,
} from '@massalabs/as-types';
import { PersistentMap } from '../lib/PersistentMap';
import { Pool } from '../structs/pool';
import { _setOwner } from '../utils/ownership-internal';
import {
  _buildPoolKey,
  sortPoolTokenAddresses,
  transferRemaining,
} from '../utils';
import { NATIVE_MAS_COIN_ADDRESS } from '../utils/constants';
import { onlyOwner } from '../utils/ownership';
import { IBasicPool } from '../interfaces/IBasicPool';
import { IMRC20 } from '../interfaces/IMRC20';
import { isBetweenZeroAndTenPercent, isBetweenZeroAndThirtyPercent } from '../lib/math';
import { u256 } from 'as-bignum/assembly';
import { ReentrancyGuard } from '../lib/ReentrancyGuard';
import { getBalanceEntryCost } from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20-external';
import { CreateNewPoolData } from '../types/basicPool';

// pools persistent map to store the pools in the registery
export const pools = new PersistentMap<string, Pool>('pools');
// store the protocol fee
export const feeShareProtocol: StaticArray<u8> =
  stringToBytes('feeShareProtocol');
// store the protocol fee receiver
export const feeShareProtocolReceiver: StaticArray<u8> = stringToBytes(
  'feeShareProtocolReceiver',
);
// storage key containning the address of wrapped mas token inside the registry contract
// we need this key to use on the basic poll contract on swap with Mas to unwrap the mas coin
export const wmasTokenAddress = stringToBytes('wmasTokenAddress');
// Storage key containning the flash loan fee value of the pool. value is between 0 and 1
export const flashLoanFee = stringToBytes('flashLoanFee');
// Storage Key containning the address of the swap Router contract to be used on all the pools
export const swapRouterAddress = stringToBytes('swapRouterAddress');

/**
 * This function is meant to be called only one time: when the contract is deployed.
 *
 * @param binaryArgs - Arguments serialized with Args
 */
export function constructor(binaryArgs: StaticArray<u8>): void {
  // This line is important. It ensures that this function can't be called in the future.
  // If you remove this check, someone could call your constructor function and reset your smart contract.
  assert(Context.isDeployingContract());

  const args = new Args(binaryArgs);

  // read the arguments
  const feeShareProtocolInput = args
    .nextU64()
    .expect('FeeShareProtocol is missing or invalid');

  const wmasTokenAddressInput = args
    .nextString()
    .expect('WmasTokenAddress is missing or invalid');

  const flashLoanFeeInput = args.nextU64().expect('FlashLoanFee is missing');

  // ensure that the fee share protocol is between 0 and 30%
  assert(
    isBetweenZeroAndThirtyPercent(feeShareProtocolInput),
    'Fee share protocol must be between 0 and 30%',
  );

  // Ensure that the flash loan fee is between 0 and 10%
  assert(
    isBetweenZeroAndTenPercent(flashLoanFeeInput),
    'Flash loan fee must be between 0 and 10%',
  );

  // ensure taht the wmasTokenAddress is a smart contract address
  assertIsSmartContract(wmasTokenAddressInput);

  // store wmasTokenAddress
  Storage.set(wmasTokenAddress, stringToBytes(wmasTokenAddressInput));

  // store fee share protocol
  Storage.set(feeShareProtocol, u64ToBytes(feeShareProtocolInput));

  // store flashLoanFee
  Storage.set(flashLoanFee, u64ToBytes(flashLoanFeeInput));

  // Get the caller of the constructo
  const callerAddress = Context.caller().toString();

  // Set the fee share protocol receiver to the caller of the constructor
  Storage.set(feeShareProtocolReceiver, stringToBytes(callerAddress));

  // set the owner of the registry contract to the caller of the constructor
  _setOwner(callerAddress);

  // Set an empty addres for the swap router address
  Storage.set(swapRouterAddress, stringToBytes(''));

  // Initialize the reentrancy guard
  ReentrancyGuard.__ReentrancyGuard_init();

  // Emit an event
  generateEvent(
    createEvent('REGISTRY_CONTRACT_DEPLOYED', [
      Context.callee().toString(), // Smart contract address
      callerAddress, // Caller address
      feeShareProtocolInput.toString(), // Fee share protocol
      wmasTokenAddressInput, // Wmas token address
      flashLoanFeeInput.toString(), // Flash loan fee
    ]),
  );
}

/**
 *  Adds a new pool to the registery.
 *  @param binaryArgs - Arguments serialized with Args (tokenA, tokenB, feeShareProtocol, inputFeeRate)
 * @returns void
 */
export function createNewPool(binaryArgs: StaticArray<u8>): void {
  // Start reentrancy guard
  ReentrancyGuard.nonReentrant();

  const args = new Args(binaryArgs);

  let aTokenAddress = args
    .nextString()
    .expect('TokenAddress A is missing or invalid');

  let bTokenAddress = args
    .nextString()
    .expect('TokenAddress B is missing or invalid');

  const inputFeeRate = args
    .nextU64()
    .expect('InputFeeRate is missing or invalid');

  // Get the current balance of the smart contract
  const SCBalance = balance();
  // Get the coins transferred to the smart contract
  const sent = Context.transferredCoins();

  const wmasTokenAddressStored = bytesToString(Storage.get(wmasTokenAddress));

  // Check if bTokenAddress is native mas
  // WMAS can only be used as bToken since token ordering during pool creation ensures WMAS if exists, it is always assigned as bToken
  if (bTokenAddress == NATIVE_MAS_COIN_ADDRESS) {
    // Change bTokenAddress to wmasTokenAddress
    bTokenAddress = wmasTokenAddressStored;
  } else if (aTokenAddress == NATIVE_MAS_COIN_ADDRESS) {
    // Change aTokenAddress to wmasTokenAddress
    aTokenAddress = wmasTokenAddressStored;
  }

  // sort aTokenAddress and bTokenAddress
  const sortedTokens = sortPoolTokenAddresses(
    aTokenAddress,
    bTokenAddress,
    wmasTokenAddressStored,
  );

  aTokenAddress = sortedTokens[0];
  bTokenAddress = sortedTokens[1];

  // Call the internal function
  const result = _createNewPool(aTokenAddress, bTokenAddress, inputFeeRate);

  // Transfer the remaining coins to the caller
  transferRemaining(SCBalance, balance(), sent, Context.caller());

  // End reentrancy guard
  ReentrancyGuard.endNonReentrant();

  // Emit an event
  generateEvent(
    createEvent('CREATE_NEW_POOL', [
      Context.callee().toString(), // Smart contract address
      Context.caller().toString(), // Caller address
      result.poolAddress, // Pool address
      aTokenAddress, // Token A address
      bTokenAddress, // Token B address
      inputFeeRate.toString(), // Input fee rate
      result.flashLoanFee.toString(), // Flash loan fee
    ]),
  );
}

/**
 * Creates a new pool with initial liquidity using the provided binary arguments.
 *
 * @param {StaticArray<u8>} binaryArgs - The serialized arguments containing:
 *   - aTokenAddress: The address of token A.
 *   - bTokenAddress: The address of token B.
 *   - aAmount: The initial amount of token A to add as liquidity.
 *   - bAmount: The initial amount of token B to add as liquidity.
 *   - minAmountA: The minimum amount of token A to add as liquidity.
 *   - minAmountB: The minimum amount of token B to add as liquidity.
 *   - inputFeeRate: The fee rate for the pool.
 *   - isBNative: A boolean indicating whether token B is a native token.
 *
 * @throws Will throw an error if any of the required arguments are missing or invalid.
 */
export function createNewPoolWithLiquidity(binaryArgs: StaticArray<u8>): void {
  // Start reentrancy guard
  ReentrancyGuard.nonReentrant();

  const args = new Args(binaryArgs);

  let aTokenAddress = args
    .nextString()
    .expect('TokenAddress A is missing or invalid');

  let bTokenAddress = args
    .nextString()
    .expect('TokenAddress B is missing or invalid');

  let aAmount = args.nextU256().expect('TokenAmount A is missing or invalid');
  let bAmount = args.nextU256().expect('TokenAmount B is missing or invalid');

  let minAmountA = args.nextU256().expect('minAmountA is missing or invalid');
  let minAmountB = args.nextU256().expect('minAmountB is missing or invalid');

  const inputFeeRate = args
    .nextU64()
    .expect('InputFeeRate is missing or invalid');

  // Default value of a boolean is false
  const isBTokenNativeMas = args.nextBool().unwrapOrDefault();

  // Get the balance of the contract when the transaction was initiated
  const SCBalance = balance();

  // Get the calller transferred coins
  const transferredCoins = Context.transferredCoins();

  // Get the wmas token address stored
  const wmasTokenAddressStored = bytesToString(Storage.get(wmasTokenAddress));

  // Check if bTokenAddress is native mas, if so, change it to wmasTokenAddress else throw error
  if (isBTokenNativeMas) {
    // Ensure that bTokenAddress passed is native mas
    assert(
      bTokenAddress == NATIVE_MAS_COIN_ADDRESS,
      'B_TOKEN_ADDRESS_MUST_BE_NATIVE_MAS',
    );

    // Change bTokenAddress to wmasTokenAddress
    bTokenAddress = wmasTokenAddressStored;
  }

  // Sort the tokens based on the token addresses
  const sortedTokens = sortPoolTokenAddresses(
    aTokenAddress,
    bTokenAddress,
    wmasTokenAddressStored,
  );

  const aSortedToken = sortedTokens[0];
  const bSortedToken = sortedTokens[1];

  // if Tokens are reversed on the sortedTokens array, reverse the amounts and min amounts
  if (aTokenAddress != aSortedToken) {
    // Reverse the amounts
    const temp = aAmount;
    aAmount = bAmount;
    bAmount = temp;
    // Reverse the min amounts
    const tempMin = minAmountA;
    minAmountA = minAmountB;
    minAmountB = tempMin;
  }

  // Updates the tokens based on the sort order
  aTokenAddress = aSortedToken;
  bTokenAddress = bSortedToken;

  // Coins To Send on addLiquidityFromRegistry function
  let coinsToSendOnAddLiquidity = u64(0);

  // Call the internal function
  const result = _createNewPool(aTokenAddress, bTokenAddress, inputFeeRate);

  const poolContract = result.poolContract;

  const callerAddress = Context.caller();

  // Transfer amount A to the pool contract
  new IMRC20(new Address(aTokenAddress)).transferFrom(
    callerAddress,
    poolContract._origin,
    aAmount,
    getBalanceEntryCost(aTokenAddress, poolContract._origin.toString()),
  );

  // Get the current balance
  const currentBalance = balance();

  // Calculate the spent coins
  const spent = SCBalance - currentBalance;

  generateEvent(
    `Transferred ${spent} coins from ${callerAddress} to ${Context.callee().toString()}`,
  );

  // If bTokenAddress is native mas, transfer the remainning from transferredCoins to the pool contract
  coinsToSendOnAddLiquidity = transferredCoins - spent;

  generateEvent(
    `Transferred ${coinsToSendOnAddLiquidity} coins from ${callerAddress} to ${poolContract._origin}`,
  );

  if (isBTokenNativeMas) {
    // Check if the coins to send on addLiquidityFromRegistry function are greater than or equal to bAmount
    assert(
      u256.fromU64(coinsToSendOnAddLiquidity) >= bAmount,
      'INSUFFICIENT COINS TO SEND',
    );
  } else {
    // Transfer amount B to the pool contract if bTokenAddress is not native mas
    new IMRC20(new Address(bTokenAddress)).transferFrom(
      callerAddress,
      poolContract._origin,
      bAmount,
      getBalanceEntryCost(bTokenAddress, poolContract._origin.toString()),
    );
  }

  // Call the addLiquidityFromRegistry function inside the pool contract
  poolContract.addLiquidityFromRegistry(
    callerAddress,
    aAmount,
    bAmount,
    minAmountA,
    minAmountB,
    isBTokenNativeMas,
    coinsToSendOnAddLiquidity,
  );

  // End reentrancy guard
  ReentrancyGuard.endNonReentrant();

  generateEvent(
    createEvent('CREATE_NEW_POOL_WITH_LIQUIDITY', [
      Context.callee().toString(), // Smart contract address
      callerAddress.toString(), // Caller address
      result.poolAddress, // Pool address
      aTokenAddress, // Token A address
      bTokenAddress, // Token B address
      inputFeeRate.toString(), // Input fee rate
      result.flashLoanFee.toString(), // Flash loan fee
    ]),
  );
}

/**
 * Sets the swap router address in the registry contract.
 * This function can only be called by the contract owner.
 * It starts a reentrancy guard to prevent reentrancy attacks.
 * The function asserts that the provided swap router address is a valid smart contract address.
 * It then stores the swap router address in the contract's storage.
 * Finally, it generates an event to notify about the updated swap router address.
 *
 * @param binaryArgs - A static array of bytes representing the serialized input arguments.
 *   - swapRouterAddress - The address of the swap router contract.
 */
export function setSwapRouterAddress(binaryArgs: StaticArray<u8>): void {
  // Only the owner can call this function
  onlyOwner();

  // Start reentrancy guard
  ReentrancyGuard.nonReentrant();

  const args = new Args(binaryArgs);

  const swapRouterAddressInput = args
    .nextString()
    .expect('SwapRouterAddress is missing or invalid');

  // Assert that the swapRouterAddress is a smart contract
  assertIsSmartContract(swapRouterAddressInput);

  // Set the swapRouterAddress
  Storage.set(swapRouterAddress, stringToBytes(swapRouterAddressInput));

  generateEvent(`Set SwapRouterAddress to :  ${swapRouterAddressInput}`);

  // End reentrancy guard
  ReentrancyGuard.endNonReentrant();
}

/**
 * Retrieves the stored swap router address.
 * @returns The stored swap router address as a static array of bytes.
 * @throws Will throw an error if the swap router address is not set.
 */
export function getSwapRouterAddress(): StaticArray<u8> {
  // Get the swapRouterAddress
  const swapRouterAddressStored = Storage.get(swapRouterAddress);

  assert(swapRouterAddressStored.length > 0, 'Swap Router Address is not set');

  return swapRouterAddressStored;
}

/**
 * Retrieves a serialized pool object based on the provided binary arguments.
 *
 * @param binaryArgs - A static array of bytes representing the serialized input arguments.
 * - aTokenAddress - The address of the first token in the pool.
 * - bTokenAddress - The address of the second token in the pool.
 * - inputFeeRate - The input fee rate for the pool.
 * @returns A static array of bytes representing the serialized pool object.
 * @throws Will throw an error if the token addresses or input fee rate are missing or invalid,
 *         or if the pool does not exist.
 */
export function getPool(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);

  const aTokenAddress = args
    .nextString()
    .expect('TokenAddress A is missing or invalid');
  const bTokenAddress = args
    .nextString()
    .expect('TokenAddress B is missing or invalid');

  const inputFeeRate = args
    .nextU64()
    .expect('InputFeeRate is missing or invalid');

  const wmasTokenAddressStored = bytesToString(Storage.get(wmasTokenAddress));

  const poolKey = _buildPoolKey(
    aTokenAddress,
    bTokenAddress,
    inputFeeRate,
    wmasTokenAddressStored,
  );

  assert(pools.contains(poolKey), `Pool does not exist:: " ${poolKey}`);

  const pool = pools.get(poolKey, new Pool());

  return new Args().add<Pool>(pool).serialize();
}

/**
 * Get the fee share protocol
 * @returns  The fee share protocol
 */
export function getFeeShareProtocol(): StaticArray<u8> {
  return Storage.get(feeShareProtocol);
}

/**
 * Retrieves the flash loan fee from storage.
 *
 * @returns {StaticArray<u8>} The flash loan fee as a byte array.
 */
export function getFlashLoanFee(): StaticArray<u8> {
  return Storage.get(flashLoanFee);
}

/**
 * Get the fee share protocol receiver
 * @returns  The fee share protocol receiver
 */
export function getFeeShareProtocolReceiver(): StaticArray<u8> {
  return Storage.get(feeShareProtocolReceiver);
}

/**
 * Set the fee share protocol receiver
 * @param binaryArgs  The fee share protocol receiver
 * @returns  void
 */
export function setFeeShareProtocolReceiver(binaryArgs: StaticArray<u8>): void {
  // start reentrancy guard
  ReentrancyGuard.nonReentrant();

  // Get the current balance of the smart contract
  const SCBalance = balance();
  // Get the coins transferred to the smart contract
  const sent = Context.transferredCoins();

  // Only owner of registery can set the protocol fee receiver
  onlyOwner();

  const args = new Args(binaryArgs);

  const receiver = args.nextString().expect('Invalid protocol fee receiver');

  assert(validateAddress(receiver), 'INVALID ADDRESS');

  Storage.set(feeShareProtocolReceiver, stringToBytes(receiver));

  // Transfer the remaining coins back to the caller
  transferRemaining(SCBalance, balance(), sent, Context.caller());

  // End reentrancy guard
  ReentrancyGuard.endNonReentrant();

  // Emit event
  generateEvent(
    createEvent('UPDATE_FEE_SHARE_PROTOCOL_RECEIVER', [
      Context.callee().toString(), // Smart contract address
      Context.caller().toString(), // Caller address
      receiver, // New Receiver address
    ]),
  );
}

/**
 * Get the wmas token address
 * @returns  The wmas token address
 */
export function getWmasTokenAddress(): StaticArray<u8> {
  return Storage.get(wmasTokenAddress);
}

/**
 * Set the wmas token address
 * @param binaryArgs  The wmas token address
 * @returns  void
 */

export function setWmasTokenAddress(binaryArgs: StaticArray<u8>): void {
  // start reentrancy guard
  ReentrancyGuard.nonReentrant();

  // Only owner of registery can set wmas token address
  onlyOwner();

  const args = new Args(binaryArgs);

  const wmasTokenAddressInput = args
    .nextString()
    .expect('WmasTokenAddress is missing or invalid');

  // Get the current balance of the smart contract
  const SCBalance = balance();
  // Get the coins transferred to the smart contract
  const sent = Context.transferredCoins();

  // Ensure taht the wmasTokenAddress is a smart contract address
  assertIsSmartContract(wmasTokenAddressInput);

  // Store wmasTokenAddress
  Storage.set(wmasTokenAddress, stringToBytes(wmasTokenAddressInput));

  // Emit an event
  generateEvent(
    createEvent('UPDATE_WMAS_TOKEN_ADDRESS', [
      Context.callee().toString(), // Smart contract address
      Context.caller().toString(), // Caller address
      wmasTokenAddressInput, // New wmas token address
    ]),
  );

  // Transfer the remaining coins back to the caller
  transferRemaining(SCBalance, balance(), sent, Context.caller());

  // End reentrancy guard
  ReentrancyGuard.endNonReentrant();
}

/**
 * Checks if a pool with the given token addresses and input fee rate exists in the registry.
 * @param binaryArgs - An array of binary arguments containing the token addresses and input fee rate.
 * @returns - A byte array indicating whether the pool exists (1) or not (0).
 */
export function isPoolExists(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);

  const aTokenAddress = args.nextString().expect('aTokenAddress is missing');
  const bTokenAddress = args.nextString().expect('bTokenAddress is missing');
  const inputFeeRate = args.nextU64().expect('inputFeeRate is missing');

  const wmasTokenAddressStored = bytesToString(Storage.get(wmasTokenAddress));

  const poolKey = _buildPoolKey(
    aTokenAddress,
    bTokenAddress,
    inputFeeRate,
    wmasTokenAddressStored,
  );

  const poolExists = pools.contains(poolKey);

  return boolToByte(poolExists);
}

/**
 *  Creates a new pool and adds it to the registery.
 *  @param aTokenAddress - Address of Token A.
 *  @param bTokenAddress - Address of Token B.
 *  @param inputFeeRate - Input fee rate.
 *  @returns CreateNewPoolData
 */
function _createNewPool(
  aTokenAddress: string,
  bTokenAddress: string,
  inputFeeRate: u64,
): CreateNewPoolData {
  // Ensure that the input fee rate is between 0 and 10%
  assert(
    isBetweenZeroAndTenPercent(inputFeeRate),
    'Input fee rate must be between 0 and 10%',
  );

  // Ensure that the aTokenAddress and bTokenAddress are different
  assert(aTokenAddress !== bTokenAddress, 'Tokens must be different');

  // Ensure taht the aTokenAddress and bTokenAddress are smart contract addresses
  assertIsSmartContract(aTokenAddress);
  assertIsSmartContract(bTokenAddress);

  const wmasTokenAddressStored = bytesToString(Storage.get(wmasTokenAddress));

  //  check if the pool is already in the registery
  const poolKey = _buildPoolKey(
    aTokenAddress,
    bTokenAddress,
    inputFeeRate,
    wmasTokenAddressStored,
  );

  assert(!pools.contains(poolKey), 'Pool already in the registery');

  // Get the fee share protocol stored in the registry
  const feeShareProtocolStored = _getFeeShareProtocol();

  // Get the flash loan fee stored in the registry
  const flashLoanFeeStored = _getFlashLoanFee();

  //  Deploy the pool contract
  const poolByteCode: StaticArray<u8> = fileToByteArray('build/basicPool.wasm');
  const poolAddress = createSC(poolByteCode);

  //  Init the pool contract
  const poolContract = new IBasicPool(poolAddress);

  poolContract.init(
    aTokenAddress,
    bTokenAddress,
    inputFeeRate,
    feeShareProtocolStored,
    flashLoanFeeStored,
    Context.callee().toString(), // registry address
  );

  // Add the pool to the registery
  const pool = new Pool(
    poolAddress,
    new Address(aTokenAddress),
    new Address(bTokenAddress),
    inputFeeRate,
  );

  // Store the pool in the pools persistent map
  pools.set(poolKey, pool);

  return new CreateNewPoolData(
    poolAddress.toString(),
    flashLoanFeeStored,
    poolContract,
  );
}

/**
 * Retrieves the fee share protocol value from storage and converts it to a floating-point number.
 *
 * @returns {u64} The fee share protocol value as a 64-bit floating-point number.
 */
function _getFeeShareProtocol(): u64 {
  return bytesToU64(Storage.get(feeShareProtocol));
}

/**
 * Retrieves the flash loan fee value from storage and converts it to a 64-bit floating-point number.
 *
 * @returns {u64} The flash loan fee value as a 64-bit floating-point number.
 */
function _getFlashLoanFee(): u64 {
  return bytesToU64(Storage.get(flashLoanFee));
}

// Export all the functions from the ownership functions
export * from '../utils/ownership';
