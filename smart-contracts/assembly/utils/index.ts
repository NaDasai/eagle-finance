import { Args, SafeMath } from '@massalabs/as-types';
import {
  Address,
  Context,
  generateEvent,
  transferCoins,
} from '@massalabs/massa-as-sdk';
import { IMRC20 } from '../interfaces/IMRC20';
import { u256 } from 'as-bignum/assembly';
import { IRegistery } from '../interfaces/IRegistry';
import { IWMAS } from '@massalabs/sc-standards/assembly/contracts/MRC20/IWMAS';
import { SafeMath256 } from '../lib/safeMath';

/**
 * Builds a pool key using the token addresses and the input fee rate.
 * @param tokenA - Address of token A.
 * @param tokenB - Address of token B.
 * @param inputFeeRate - Input fee rate for the pool.
 * @returns string - Pool key.
 */
export function _buildPoolKey(
  tokenA: string,
  tokenB: string,
  inputFeeRate: u64,
  wmasAddress: string,
): string {
  // sort the addresses to ensure that the key of the pool is always the same
  // Ensure WMAS if exists, it is always tokenB
  const sortedTokens = sortPoolTokenAddresses(tokenA, tokenB, wmasAddress);

  const sortedTokenA = sortedTokens[0];
  const sortedTokenB = sortedTokens[1];

  const key = `${sortedTokenA}-${sortedTokenB}-${inputFeeRate.toString()}`;

  generateEvent(`Built pool key: ${key}`);

  return key;
}

export function sortPoolTokenAddresses(
  tokenA: string,
  tokenB: string,
  wmasAddress: string,
): string[] {
  // If either token is wmasAddress, ensure it is always tokenB
  if (tokenA == wmasAddress) {
    // Swap if tokenA is wmasAddress
    const temp = tokenA;
    tokenA = tokenB;
    tokenB = temp;
  } else if (tokenB != wmasAddress && tokenA > tokenB) {
    // Sort tokens lexicographically if neither is wmasAddress
    const temp = tokenA;
    tokenA = tokenB;
    tokenB = temp;
  }

  return [tokenA, tokenB];
}

/**
 * Serializes an array of strings into a static array of bytes.
 * @param arr - Array of strings to serialize.
 * @returns StaticArray<u8> - Serialized array of bytes.
 */
export function serializeStringArray(arr: string[]): StaticArray<u8> {
  return new Args().add(arr).serialize();
}

/**
 * Deserializes a static array of bytes into an array of strings.
 * @param arr - StaticArray<u8> to deserialize.
 * @returns Array<string> - Deserialized array of strings.
 */
export function deserializeStringArray(arr: StaticArray<u8>): string[] {
  return new Args(arr).nextStringArray().unwrapOrDefault();
}

/**
 * @notice Function to transfer remaining Massa coins to a recipient at the end of a call
 * @param balanceInit Initial balance of the SC (transferred coins + balance of the SC)
 * @param balanceFinal Balance of the SC at the end of the call
 * @param sent Number of coins sent to the SC
 * @param to Caller of the function to transfer the remaining coins to
 */
export function transferRemaining(
  balanceInit: u64,
  balanceFinal: u64,
  sent: u64,
  to: Address,
): void {
  if (balanceInit >= balanceFinal) {
    // Some operation might spend Massa by creating new storage space
    const spent = SafeMath.sub(balanceInit, balanceFinal);
    generateEvent(`Spent ${spent} coins`);
    assert(spent <= sent, 'SPENT_MORE_COINS_THAN_SENT');
    if (spent < sent) {
      // SafeMath not needed as spent is always less than sent
      const remaining: u64 = sent - spent;
      _transferRemaining(to, remaining);
    }
  } else {
    // Some operation might unlock Massa by deleting storage space
    const received = SafeMath.sub(balanceFinal, balanceInit);
    const totalToSend: u64 = SafeMath.add(sent, received);
    _transferRemaining(to, totalToSend);
  }
}

function _transferRemaining(to: Address, value: u64): void {
  transferCoins(to, value);
}

export function _computeMintStorageCost(receiver: Address): u64 {
  const STORAGE_BYTE_COST = 100_000;
  const STORAGE_PREFIX_LENGTH = 4;
  const BALANCE_KEY_PREFIX_LENGTH = 7;

  const baseLength = STORAGE_PREFIX_LENGTH;
  const keyLength = BALANCE_KEY_PREFIX_LENGTH + receiver.toString().length;
  const valueLength = 4 * sizeof<u64>();
  return (baseLength + keyLength + valueLength) * STORAGE_BYTE_COST;
}

export function getTokenBalance(address: Address): u256 {
  const token = new IMRC20(address);
  return token.balanceOf(Context.callee());
}

/**
 * Wraps a specified amount of MAS coins into WMAS tokens.
 *
 * @param amount - The amount of MAS coins to be wrapped into WMAS tokens.
 * @param wmasAddress - The address of the WMAS token contract.
 * @throws Will throw an error if the transferred MAS coins are insufficient.
 */
export function wrapMasToWMAS(amount: u256, wmasAddress: Address): void {
  // Get the transferred coins from the operation
  const transferredCoins = Context.transferredCoins();

  // Get the wmas contract instance
  const wmasToken = new IWMAS(wmasAddress);

  const mintStorageCost = u256.fromU64(
    _computeMintStorageCost(Context.callee()),
  );

  const amountToWrap = SafeMath256.add(amount, mintStorageCost);

  // Ensure that transferred coins are greater than or equal to the amount to wrap
  assert(
    u256.fromU64(transferredCoins) >= amountToWrap,
    'INSUFFICIENT MAS COINS TRANSFERRED',
  );

  // Wrap MAS coins into WMAS
  wmasToken.deposit(amountToWrap.toU64());

  // Generate an event to indicate that MAS coins have been wrapped into WMAS
  generateEvent(`WRAP_MAS: ${amount.toString()} of MAS wrapped into WMAS`);
}
