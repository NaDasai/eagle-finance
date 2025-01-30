import {
  Args,
  bytesToString,
  bytesToU256,
  bytesToU64,
  f64ToBytes,
  stringToBytes,
  u256ToBytes,
  u64ToBytes,
} from '@massalabs/as-types';
import {
  Address,
  Context,
  createEvent,
  generateEvent,
  Storage,
} from '@massalabs/massa-as-sdk';
import { IBasicPool } from '../interfaces/IBasicPool';
import { u256 } from 'as-bignum/assembly';
import { ReentrancyGuard } from '../lib/ReentrancyGuard';
import { SafeMath256 } from '../lib/safeMath';

export const poolAddress = stringToBytes('poolAddress');
export const aTokenAddress = stringToBytes('aTokenAddress');
export const bTokenAddress = stringToBytes('bTokenAddress');
export const feeRate = stringToBytes('feeRate');
// Storage keys for cumulative prices
export const aPriceCumulativeLast = stringToBytes('aPriceCumulativeLast');
export const bPriceCumulativeLast = stringToBytes('bPriceCumulativeLast');
// Storage key for last timestamp
export const lastTimestamp = stringToBytes('lastTimestamp');
// Strorage key for average price of token A
export const aPriceAverage = stringToBytes('aPriceAverage');
// Strorage key for average price of token B
export const bPriceAverage = stringToBytes('bPriceAverage');
// Strorage key for the period of time should be passed before updating the price in milliseconds
export const period = stringToBytes('period');

export function constructor(binaryArgs: StaticArray<u8>): void {
  // This line is important. It ensures that this function can't be called in the future.
  // If you remove this check, someone could call your constructor function and reset your smart contract.
  assert(Context.isDeployingContract());

  const args = new Args(binaryArgs);

  const poolAddressInput = args
    .nextString()
    .expect('PoolAddress is missing or invalid');

  const aTokenAddressInput = args
    .nextString()
    .expect('ATokenAddress is missing or invalid');

  const bTokenAddressInput = args
    .nextString()
    .expect('BTokenAddress is missing or invalid');

  const inputFeeRate = args
    .nextF64()
    .expect('InputFeeRate is missing or invalid');

  const periodInput = args.nextU64().expect('Period is missing or invalid');

  // Init the pool contract
  const poolContract = new IBasicPool(new Address(poolAddressInput));

  // Get the last commulative prices
  const aPoolPriceCumulativeLast = poolContract.getAPriceCumulativeLast();
  const bPoolPriceCumulativeLast = poolContract.getBPriceCumulativeLast();
  const poolLastTimestamp = poolContract.getLastTimestamp();

  // Get the pool reserves
  const aPoolReserve = poolContract.getLocalReserveA();
  const bPoolReserve = poolContract.getLocalReserveB();

  // Ensure that teh pool has liquidity
  assert(
    aPoolReserve > u256.Zero && bPoolReserve > u256.Zero,
    'POOL_WITHOUT_LIQUIDITY',
  );

  // Store the pool address
  Storage.set(poolAddress, stringToBytes(poolAddressInput));
  // Store the token A address
  Storage.set(aTokenAddress, stringToBytes(aTokenAddressInput));
  // Store the token B address
  Storage.set(bTokenAddress, stringToBytes(bTokenAddressInput));
  // Store the fee rate
  Storage.set(feeRate, f64ToBytes(inputFeeRate));
  // Store the cumulative prices
  Storage.set(aPriceCumulativeLast, u256ToBytes(aPoolPriceCumulativeLast));
  Storage.set(bPriceCumulativeLast, u256ToBytes(bPoolPriceCumulativeLast));
  // Store the last timestamp
  Storage.set(lastTimestamp, u64ToBytes(poolLastTimestamp));
  // Store the period
  Storage.set(period, u64ToBytes(periodInput));
  // Store the average prices
  Storage.set(aPriceAverage, u256ToBytes(u256.Zero));
  Storage.set(bPriceAverage, u256ToBytes(u256.Zero));

  // Initialize ReentrantGuard
  ReentrancyGuard.__ReentrancyGuard_init();
}

/**
 * Updates the oracle's stored data by recalculating average prices and updating timestamps.
 *
 * @param binaryArgs - The binary arguments passed to the function.
 *
 * This function retrieves the current timestamp and compares it with the last stored timestamp
 * to ensure the required period has elapsed. It fetches new cumulative prices from the pool contract,
 * calculates the average prices for tokens A and B, and updates the stored cumulative prices,
 * last timestamp, and average prices in the storage.
 */
export function update(binaryArgs: StaticArray<u8>): void {
  // Start reentrancy guard
  ReentrancyGuard.nonReentrant();

  // get timestamp
  const currentTimestamp = Context.timestamp();

  // Gte the last Timestamp recoreded in the storage
  const lastTimestampStored = bytesToU64(Storage.get(lastTimestamp));

  // Get the time elasped since the last update
  const timeElasped = currentTimestamp - lastTimestampStored;

  // get the stored period
  const periodStored = bytesToU64(Storage.get(period));

  // Ensure that the period has elapsed
  assert(timeElasped > periodStored, 'PERIOD_NOT_ELAPSED');

  // Get the stored pool contract address
  const poolAddressStored = bytesToString(Storage.get(poolAddress));

  /// Fetch the pool contract new prices
  const poolContract = new IBasicPool(new Address(poolAddressStored));

  // Get the pool new cumulative prices
  const aPoolPriceCumulativeLast = poolContract.getAPriceCumulativeLast();
  const bPoolPriceCumulativeLast = poolContract.getBPriceCumulativeLast();

  // Get the oracle comulative prices
  const aPriceCumulativeLastStored = bytesToU256(
    Storage.get(aPriceCumulativeLast),
  );
  const bPriceCumulativeLastStored = bytesToU256(
    Storage.get(bPriceCumulativeLast),
  );

  // Calculate the average price of token A (aPoolPriceCumulativeLast - aPriceCumulativeLast) / timeElasped
  const aNewPriceAverage = SafeMath256.div(
    SafeMath256.sub(aPoolPriceCumulativeLast, aPriceCumulativeLastStored),
    u256.fromU64(timeElasped),
  );

  // Calculate the average price of token B (bPoolPriceCumulativeLast - bPriceCumulativeLast) / timeElasped
  const bNewPriceAverage = SafeMath256.div(
    SafeMath256.sub(bPoolPriceCumulativeLast, bPriceCumulativeLastStored),
    u256.fromU64(timeElasped),
  );

  // Update the cumulative prices
  Storage.set(aPriceCumulativeLast, u256ToBytes(aPoolPriceCumulativeLast));
  Storage.set(bPriceCumulativeLast, u256ToBytes(bPoolPriceCumulativeLast));

  // Update the last timestamp
  Storage.set(lastTimestamp, u64ToBytes(currentTimestamp));

  // Update the average prices
  Storage.set(aPriceAverage, u256ToBytes(aNewPriceAverage));
  Storage.set(bPriceAverage, u256ToBytes(bNewPriceAverage));

  generateEvent(
    `UPDATED_ORACLE: aPriceCumulativeLast: ${aPoolPriceCumulativeLast}, bPriceCumulativeLast: ${bPoolPriceCumulativeLast}, aPriceAverage: ${aNewPriceAverage}, bPriceAverage: ${bNewPriceAverage}`,
  );

  // End reentrancy guard
  ReentrancyGuard.endNonReentrant();
}

/**
 * Gets the average price of token A.
 * @param _ - Unused parameter.
 * @returns The average price of token A.
 */
export function getAPriceAverage(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(aPriceAverage);
}

/**
 * Gets the average price of token B.
 * @param _ - Unused parameter.
 * @returns The average price of token B.
 */
export function getBPriceAverage(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(bPriceAverage);
}
