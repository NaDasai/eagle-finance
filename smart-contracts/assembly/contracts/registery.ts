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

  generateEvent(`Registery Contract Deployed.`);
}

export function createPool(binaryArgs: StaticArray<u8>): void {
  // deploy new pool smart contract with the new token pairs and get its address

  const args = new Args(binaryArgs);

  const tokenAAddress = args
    .nextString()
    .expect('TokenAddress A is missing or invalid');

  const tokenBAddress = args
    .nextString()
    .expect('TokenAddress B is missing or invalid');

  // TODO: check if there is already a pool with the same token pair

  // TODO: deploy new pool smart contract with the new token pairs and get its address
  const poolAddress = new Address();

  // TODO: add the new pool to the registery
  pools.set(
    _buildPoolKey(new Address(tokenAAddress), new Address(tokenBAddress)),
    new Pool(),
  );
}

function _buildPoolKey(tokenA: Address, tokenB: Address): string {
  // sort the addresses to ensure that the key of the pool is always the same
  if (tokenA.toString() > tokenB.toString()) {
    const temp = tokenA;
    tokenA = tokenB;
    tokenB = temp;
  }
  const key = tokenA.toString() + tokenB.toString();
  return key;
}
