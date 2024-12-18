import {
  call,
  Context,
  createSC,
  generateEvent,
  Storage,
  fileToByteArray,
  getBytecode,
  getBytecodeOf,
  Address,
  validateAddress,
  assertIsSmartContract,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  bytesToF64,
  bytesToU16,
  f64ToBytes,
  stringToBytes,
  u16ToBytes,
  u256ToBytes,
} from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';
import { PersistentMap } from '../lib/PersistentMap';
import { Pool } from '../structs/pool';
import { _setOwner } from '../utils/ownership-internal';
import { _buildPoolKey } from '../utils';
import { onlyOwner } from '../utils/ownership';
import { IPool } from '../interfaces/IPool';
import { isBetweenZeroAndOne } from '../lib/math';

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

  // ensure that the fee share protocol is between 0 and 1
  assert(
    isBetweenZeroAndOne(feeShareProtocolInput),
    'Fee share protocol must be between 0 and 1',
  );

  // store fee share protocol
  Storage.set(feeShareProtocol, f64ToBytes(feeShareProtocolInput));

  // set the owner of the registry contract to the caller of the constructor
  _setOwner(Context.caller().toString());

  // store the poolsKeys array in the poolsKeys persistent map
  Storage.set(poolsKeys, new Args().add(new Array<string>()).serialize());

  generateEvent(`Registery Contract Deployed.`);
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

  const bTokenAddress = args
    .nextString()
    .expect('TokenAddress B is missing or invalid');

  const inputFeeRate = args
    .nextF64()
    .expect('InputFeeRate is missing or invalid');

  // Ensure that the fee share protocol is between 0 and 1
  assert(
    isBetweenZeroAndOne(inputFeeRate),
    'Fee share protocol must be between 0 and 1',
  );

  // Ensure taht the aTokenAddress and bTokenAddress are smart contract addresses
  assertIsSmartContract(aTokenAddress);
  assertIsSmartContract(bTokenAddress);

  //  check if the pool is already in the registery
  const poolKey = _buildPoolKey(aTokenAddress, bTokenAddress, inputFeeRate);

  assert(!pools.contains(poolKey), 'Pool already in the registery');

  // Get the fee share protocol stored in the registry
  const feeShareProtocolStored = _getFeeShareProtocol();

  //  deploy the pool contract
  const poolByteCode: StaticArray<u8> = fileToByteArray('build/pool.wasm');
  const poolAddress = createSC(poolByteCode);

  //  Init the pool contract
  const poolContract = new IPool(poolAddress);

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
  onlyOwner(); // only owner of registery can set the protocol fee receiver

  const args = new Args(binaryArgs);

  const receiver = args.nextString().expect('Invalid protocol fee receiver');

  assert(validateAddress(receiver), 'Invalid protocol fee receiver');

  Storage.set(feeShareProtocolReceiver, stringToBytes(receiver));
}

function _getFeeShareProtocol(): f64 {
  return bytesToF64(Storage.get(feeShareProtocol));
}

// exprot all the functions from teh ownership file
export * from '../utils/ownership';
