import {
  Context,
  createSC,
  generateEvent,
  Storage,
  fileToByteArray,
  Address,
  validateAddress,
  assertIsSmartContract,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  boolToByte,
  bytesToF64,
  bytesToString,
  f64ToBytes,
  stringToBytes,
} from '@massalabs/as-types';
import { PersistentMap } from '../lib/PersistentMap';
import { Pool } from '../structs/pool';
import { _setOwner } from '../utils/ownership-internal';
import { _buildPoolKey, assertIsValidTokenDecimals } from '../utils';
import { NATIVE_MAS_COIN_ADDRESS } from '../utils/constants';
import { onlyOwner } from '../utils/ownership';
import { IBasicPool } from '../interfaces/IBasicPool';
import { IMRC20 } from '../interfaces/IMRC20';
import { isBetweenZeroAndTenPercent } from '../lib/math';
import { u256 } from 'as-bignum/assembly';

// pools persistent map to store the pools in the registery
export const pools = new PersistentMap<string, Pool>('pools');
// array of pool keys in the registery
export const poolsKeys: StaticArray<u8> = stringToBytes('poolsKeys');
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
    .nextF64()
    .expect('FeeShareProtocol is missing or invalid');

  const wmasTokenAddressInput = args
    .nextString()
    .expect('WmasTokenAddress is missing or invalid');

  // ensure that the fee share protocol is between 0 and 10%
  assert(
    isBetweenZeroAndTenPercent(feeShareProtocolInput),
    'Fee share protocol must be between 0 and 10%',
  );

  // ensure taht the wmasTokenAddress is a smart contract address
  assertIsSmartContract(wmasTokenAddressInput);

  // store wmasTokenAddress
  Storage.set(wmasTokenAddress, stringToBytes(wmasTokenAddressInput));

  // store fee share protocol
  Storage.set(feeShareProtocol, f64ToBytes(feeShareProtocolInput));

  // set the owner of the registry contract to the caller of the constructor
  _setOwner(Context.caller().toString());

  // store the poolsKeys array in the poolsKeys persistent map
  Storage.set(poolsKeys, new Args().add(new Array<string>()).serialize());

  generateEvent(`Registry Contract Deployed.`);
}

/**
 *  Adds a new pool to the registery.
 *  @param binaryArgs - Arguments serialized with Args (tokenA, tokenB, feeShareProtocol, inputFeeRate)
 * @returns void
 */
export function createNewPool(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const aTokenAddress = args
    .nextString()
    .expect('TokenAddress A is missing or invalid');

  let bTokenAddress = args
    .nextString()
    .expect('TokenAddress B is missing or invalid');

  const inputFeeRate = args
    .nextF64()
    .expect('InputFeeRate is missing or invalid');

  const wmasTokenAddressStored = bytesToString(Storage.get(wmasTokenAddress));

  // Check if bTokenAddress is native mas
  // WMAS can only be used as bToken since token ordering during pool creation ensures WMAS if exists, it is always assigned as bToken
  if (bTokenAddress == NATIVE_MAS_COIN_ADDRESS) {
    // Change bTokenAddress to wmasTokenAddress
    bTokenAddress = wmasTokenAddressStored;
  }

  // Call the internal function
  _createNewPool(aTokenAddress, bTokenAddress, inputFeeRate);
}

/**
 * Creates a new pool with initial liquidity using the provided binary arguments.
 *
 * @param {StaticArray<u8>} binaryArgs - The serialized arguments containing:
 *   - aTokenAddress: The address of token A.
 *   - bTokenAddress: The address of token B.
 *   - aAmount: The initial amount of token A to add as liquidity.
 *   - bAmount: The initial amount of token B to add as liquidity.
 *   - inputFeeRate: The fee rate for the pool.
 *
 * @throws Will throw an error if any of the required arguments are missing or invalid.
 */
export function createNewPoolWithLiquidity(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const aTokenAddress = args
    .nextString()
    .expect('TokenAddress A is missing or invalid');

  let bTokenAddress = args
    .nextString()
    .expect('TokenAddress B is missing or invalid');

  const aAmount = args.nextU256().expect('TokenAmount A is missing or invalid');
  const bAmount = args.nextU256().expect('TokenAmount B is missing or invalid');

  const inputFeeRate = args
    .nextF64()
    .expect('InputFeeRate is missing or invalid');

  // Check if bTokenAddress is native mas
  // WMAS can only be used as bToken since token ordering during pool creation ensures WMAS if exists, it is always assigned as bToken.
  const isBTokenNativeMas = bTokenAddress == NATIVE_MAS_COIN_ADDRESS;

  // Coins To Send on addLiquidityFromRegistry function
  let coinsToSendOnAddLiquidity = u64(0);

  if (isBTokenNativeMas) {
    // Get the transferred coins
    const transferredCoins = Context.transferredCoins();

    // Check if the coins to send on addLiquidityFromRegistry function are greater than or equal to bAmount
    assert(
      u256.fromU64(transferredCoins) >= bAmount,
      'INSUFFICIENT MAS COINS TRANSFERRED',
    );

    // If bTokenAddress is native mas, get the transferred coins and send them to the pool contract as coins
    coinsToSendOnAddLiquidity = bAmount.toU64();

    // Get the wmas token address stored
    const wmasTokenAddressStored = bytesToString(Storage.get(wmasTokenAddress));

    // Change bTokenAddress to wmasTokenAddress
    bTokenAddress = wmasTokenAddressStored;
  }

  // Call the internal function
  const poolContract = _createNewPool(
    aTokenAddress,
    bTokenAddress,
    inputFeeRate,
  );

  // Transfer amount A to the pool contract
  new IMRC20(new Address(aTokenAddress)).transferFrom(
    Context.caller(),
    poolContract._origin,
    aAmount,
  );

  // Transfer amount B to the pool contract if bTokenAddress is not native mas
  if (!isBTokenNativeMas) {
    new IMRC20(new Address(bTokenAddress)).transferFrom(
      Context.caller(),
      poolContract._origin,
      bAmount,
    );
  }

  // Call the addLiquidityFromRegistry function inside the pool contract
  poolContract.addLiquidityFromRegistry(
    aAmount,
    bAmount,
    isBTokenNativeMas,
    coinsToSendOnAddLiquidity,
  );
}

/**
 *  Retrieves all the pools in the registery.
 *  @returns Array of Pools
 */
export function getPools(): StaticArray<u8> {
  const poolsKeysStored = Storage.get(poolsKeys);

  const deserializedPoolsKeys = new Args(poolsKeysStored)
    .nextStringArray()
    .unwrap();

  const retPools: Pool[] = [];

  for (let i = 0; i < deserializedPoolsKeys.length; i++) {
    const key = deserializedPoolsKeys[i];
    const pool = pools.get(key, new Pool());
    retPools.push(pool);
  }

  return new Args().addSerializableObjectArray(retPools).serialize();
}

/**
 * Get the fee share protocol
 * @returns  The fee share protocol
 */
export function getFeeShareProtocol(): StaticArray<u8> {
  return Storage.get(feeShareProtocol);
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
  // Only owner of registery can set the protocol fee receiver
  onlyOwner();

  const args = new Args(binaryArgs);

  const receiver = args.nextString().expect('Invalid protocol fee receiver');

  assert(validateAddress(receiver), 'INVALID ADDRESS');

  Storage.set(feeShareProtocolReceiver, stringToBytes(receiver));
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
  // Only owner of registery can set wmas token address
  onlyOwner();

  const args = new Args(binaryArgs);

  const wmasTokenAddressInput = args
    .nextString()
    .expect('WmasTokenAddress is missing or invalid');

  // Ensure taht the wmasTokenAddress is a smart contract address
  assertIsSmartContract(wmasTokenAddressInput);

  // Store wmasTokenAddress
  Storage.set(wmasTokenAddress, stringToBytes(wmasTokenAddressInput));

  // Emit an event
  generateEvent(`WMAS address updated to ${wmasTokenAddressInput}`);
}

/**
 *  Creates a new pool and adds it to the registery.
 *  @param aTokenAddress - Address of Token A.
 *  @param bTokenAddress - Address of Token B.
 *  @param inputFeeRate - Input fee rate.
 *  @returns IBasicPool
 */
function _createNewPool(
  aTokenAddress: string,
  bTokenAddress: string,
  inputFeeRate: f64,
): IBasicPool {
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

  //  check if the pool is already in the registery
  const poolKey = _buildPoolKey(aTokenAddress, bTokenAddress, inputFeeRate);

  assert(!pools.contains(poolKey), 'Pool already in the registery');

  // Get the fee share protocol stored in the registry
  const feeShareProtocolStored = _getFeeShareProtocol();

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

  // Store the pool key in the poolsKeys array
  const poolsKeysStored = Storage.get(poolsKeys);

  // Deserialize the poolsKeys array
  const deserializedPoolsKeys = new Args(poolsKeysStored)
    .nextStringArray()
    .unwrap();

  // Add the pool key to the poolsKeys array
  deserializedPoolsKeys.push(poolKey);

  // Serialize the deserialized poolsKeys array
  Storage.set(poolsKeys, new Args().add(deserializedPoolsKeys).serialize());

  // Emit an event
  generateEvent(`Pool ${poolAddress} added to the registery`);

  return poolContract;
}

/**
 * Retrieves the fee share protocol value from storage and converts it to a floating-point number.
 *
 * @returns {f64} The fee share protocol value as a 64-bit floating-point number.
 */
function _getFeeShareProtocol(): f64 {
  return bytesToF64(Storage.get(feeShareProtocol));
}

// Export all the functions from the ownership functions
export * from '../utils/ownership';
