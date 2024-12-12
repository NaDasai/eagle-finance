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
} from '@massalabs/massa-as-sdk';
import {
  Args,
  bytesToU16,
  stringToBytes,
  u16ToBytes,
} from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';
import { PersistentMap } from '../lib/PersistentMap';
import { Pool } from '../structs/pool';
import { _setOwner } from '../utils/ownership-internal';
import { _buildPoolKey } from '../utils';
import { ownerAddress } from '../utils/ownership';

export const pools = new PersistentMap<string, Pool>('pools');

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

  generateEvent(`Registery Contract Deployed.`);
}

export function subscribePool(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const poolAddress = args
    .nextString()
    .expect('PoolAddress is missing or invalid');

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

  // TODO: check if the pool is already in the registery
  const poolKey = _buildPoolKey(aTokenAddress, bTokenAddress, feeShareProtocol);

  assert(!pools.contains(poolKey), 'Pool already in the registery');

  // TODO: deploy an lp token for the pool and get its address
  const lpTokenAddress = new Address(
    '0x0000000000000000000000000000000000000000000000000000000000000000',
  );

  // TODO: add the pool to the registery
  const pool = new Pool(
    new Address(poolAddress),
    new Address(aTokenAddress),
    new Address(bTokenAddress),
    inputFeeRate,
    feeShareProtocol,
    lpTokenAddress,
  );

  pools.set(poolKey, pool);

  // TODO: emit an event
  generateEvent(`Pool ${poolAddress} added to the registery`);
}

// exprot all the functions from teh ownership file
export * from '../utils/ownership';
