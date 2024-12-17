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
} from '@massalabs/massa-as-sdk';
import {
  Args,
  bytesToU16,
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

// pools persistent map to store the pools in the registery
export const pools = new PersistentMap<string, Pool>('pools');
// array of pool keys in the registery
export const poolsKeys: StaticArray<u8> = stringToBytes('poolsKeys');
// store the protocol fee
export const protocolFee: StaticArray<u8> = stringToBytes('protocolFee');
// store the protocol fee receiver
export const protocolFeeReceiver: StaticArray<u8> = stringToBytes(
  'protocolFeeReceiver',
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

  const feeShareProtocol = args
    .nextF64()
    .expect('ProtocolFee is missing or invalid');

  const inputFeeRate = args
    .nextF64()
    .expect('InputFeeRate is missing or invalid');

  //  check if the pool is already in the registery
  const poolKey = _buildPoolKey(aTokenAddress, bTokenAddress, feeShareProtocol);

  assert(!pools.contains(poolKey), 'Pool already in the registery');

  //  deploy the pool contract
  const poolByteCode: StaticArray<u8> = fileToByteArray('build/pool.wasm');
  const poolAddress = createSC(poolByteCode);

  //  init the pool contract
  const poolContract = new IPool(poolAddress);

  poolContract.init(
    aTokenAddress,
    bTokenAddress,
    inputFeeRate,
    feeShareProtocol,
    Context.callee().toString(), // registry address
  );

  //  add the pool to the registery
  const pool = new Pool(
    poolAddress,
    new Address(aTokenAddress),
    new Address(bTokenAddress),
    inputFeeRate,
    feeShareProtocol,
  );

  // store the pool in the pools persistent map
  pools.set(poolKey, pool);

  // store the pool key in the poolsKeys array
  const poolsKeysStored = Storage.get(poolsKeys);

  const deserializedPoolsKeys = new Args(poolsKeysStored)
    .nextStringArray()
    .unwrap();

  deserializedPoolsKeys.push(poolKey);

  Storage.set(poolsKeys, new Args().add(deserializedPoolsKeys).serialize());

  //  emit an event
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

export function getProtocolFee(): StaticArray<u8> {
  return Storage.get(protocolFee);
}

export function setProtocolFee(binaryArgs: StaticArray<u8>): void {
  onlyOwner(); // only owner of registery can set the protocol fee
  const args = new Args(binaryArgs);

  const fee = args.nextU256().expect('Invalid protocol fee');

  Storage.set(protocolFee, u256ToBytes(fee));
}

export function getProtocolFeeReceiver(): StaticArray<u8> {
  return Storage.get(protocolFeeReceiver);
}

export function setProtocolFeeReceiver(binaryArgs: StaticArray<u8>): void {
  onlyOwner(); // only owner of registery can set the protocol fee receiver

  const args = new Args(binaryArgs);

  const receiver = args.nextString().expect('Invalid protocol fee receiver');

  assert(validateAddress(receiver), 'Invalid protocol fee receiver');

  Storage.set(protocolFeeReceiver, stringToBytes(receiver));
}

// exprot all the functions from teh ownership file
export * from '../utils/ownership';
