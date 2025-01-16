// This smart contract implements a liquidity pool for trading two MRC-20 tokens on the Massa blockchain.
// **IMPORTANT**: This pool **only accepts MRC-20 tokens**. To use the native MAS coin, it must be **wrapped to WMAS** first.
//  (MAS -> WMAS: native MAS must be wrapped into MRC-20 WMAS via a wrapping contract to be used in this pool).
import {
  Context,
  generateEvent,
  Storage,
  Address,
  assertIsSmartContract,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  bytesToF64,
  bytesToString,
  bytesToU256,
  bytesToU64,
  f64ToBytes,
  stringToBytes,
  u256ToBytes,
  u64ToBytes,
} from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';
import { IMRC20 } from '../interfaces/IMRC20';
import { _onlyOwner, _setOwner } from '../utils/ownership-internal';
import { getTokenBalance } from '../utils/token';
import { getAmountOut, getFeeFromAmount } from '../lib/basicPoolMath';
import { IRegistery } from '../interfaces/IRegistry';
import { _ownerAddress } from '../utils/ownership';
import { SafeMath256 } from '../lib/safeMath';
import {
  LiquidityManager,
  StoragePrefixManager,
} from '../lib/liquidityManager';
import { HUNDRED_PERCENT, NATIVE_MAS_COIN_ADDRESS } from '../utils/constants';
import { IWMAS } from '@massalabs/sc-standards/assembly/contracts/MRC20/IWMAS';
import { IEagleCallee } from '../interfaces/IEagleCallee';

// Storage key containning the value of the token A reserve inside the pool
export const aTokenReserve = stringToBytes('aTokenReserve');
// Storage key containning the value of the token B reserve inside the pool
export const bTokenReserve = stringToBytes('bTokenReserve');
// Storage key containning address of the token A inside the pool
export const aTokenAddress = stringToBytes('tokenA');
// storage key containning address of the token B inside the pool
export const bTokenAddress = stringToBytes('tokenB');
// Storage key containning the accumulated fee protocol of the token A inside the pool
export const aProtocolFee = stringToBytes('aProtocolFee');
// Storage key containning the accumulated fee protocol of the token B inside the pool
export const bProtocolFee = stringToBytes('bProtocolFee');
// Storage key containning the fee rate value of the pool. value is between 0 and 1
export const feeRate = stringToBytes('feeRate');
// Storage key containning the fee share protocol value of the pool. value is between 0 and 1
export const feeShareProtocol = stringToBytes('feeShareProtocol');
// Storage key containning the address of the registry contract inside the pool
export const registryContractAddress = stringToBytes('registry');
// Create new liquidity manager representing the pool LP token
const storagePrefixManager = new StoragePrefixManager();
const liquidityManager = new LiquidityManager<u256>(storagePrefixManager);
// Storage keys for cumulative prices
export const aPriceCumulative = stringToBytes('aPriceCumulative');
export const bPriceCumulative = stringToBytes('bPriceCumulative');

// Storage key for last timestamp
export const lastTimestamp = stringToBytes('lastTimestamp');

/**
 * This function is meant to be called only one time: when the contract is deployed.
 * @param binaryArgs - Arguments serialized with Args
 * - `aAddress`: Address of token A.
 * - `bAddress`: Address of token B.
 * - `inputFeeRate`: Input fee rate for the pool.
 * - `feeShareProtocol`: Fee share protocol for the pool.
 * - `registryAddress`: Address of the registry contract.
 * @returns void
 */
export function constructor(binaryArgs: StaticArray<u8>): void {
  // This line is important. It ensures that this function can't be called in the future.
  // If you remove this check, someone could call your constructor function and reset your smart contract.
  assert(Context.isDeployingContract());

  const args = new Args(binaryArgs);

  // Read the arguments
  const aAddress = args.nextString().expect('Address A is missing or invalid');
  const bAddress = args.nextString().expect('Address B is missing or invalid');

  const inputFeeRate = args
    .nextF64()
    .expect('Input fee rate is missing or invalid');

  const feeShareProtocolInput = args
    .nextF64()
    .expect('Fee share protocol is missing or invalid');

  const registryAddress = args
    .nextString()
    .expect('RegistryAddress is missing or invalid');

  // We already checking if address A, address B, fee rate, and fee share protocol are valid in the registry

  // ensure that the registryAddress is a valid smart contract address
  assertIsSmartContract(registryAddress);

  // Store fee rate
  Storage.set(feeRate, f64ToBytes(inputFeeRate));

  // Store fee share protocol
  Storage.set(feeShareProtocol, f64ToBytes(feeShareProtocolInput));

  // store the a and b protocol fees
  Storage.set(aProtocolFee, u256ToBytes(u256.Zero));
  Storage.set(bProtocolFee, u256ToBytes(u256.Zero));

  // Store the tokens a and b addresses
  Storage.set(aTokenAddress, stringToBytes(aAddress));
  Storage.set(bTokenAddress, stringToBytes(bAddress));

  // Store the tokens a and b addresses reserves in the contract storage
  Storage.set(aTokenReserve, u256ToBytes(u256.Zero));
  Storage.set(bTokenReserve, u256ToBytes(u256.Zero));

  // Store the registry address
  Storage.set(registryContractAddress, stringToBytes(registryAddress));

  // Get the registry contract instance
  const registry = new IRegistery(new Address(registryAddress));

  // Set the owner of the pool contract to the same registry owner address
  _setOwner(registry.ownerAddress());

  // Set the default prices to zero
  Storage.set(aPriceCumulative, u256ToBytes(u256.Zero));
  Storage.set(bPriceCumulative, u256ToBytes(u256.Zero));

  // Set the current timestamp
  Storage.set(lastTimestamp, u64ToBytes(Context.timestamp()));

  generateEvent(
    `New pool deployed at ${Context.callee()}. Token A: ${aAddress}. Token B: ${bAddress}. Registry: ${registryAddress}.`,
  );
}

/**
 *  Adds liquidity to the pool.
 *  @param binaryArgs - Arguments serialized with Args
 *  - `amountA`: The amount of token A to add to the pool.
 *  - `amountB`: The amount of token B to add to the pool.
 * @returns void
 */
export function addLiquidity(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  let amountA = args.nextU256().expect('Amount A is missing or invalid');
  let amountB = args.nextU256().expect('Amount B is missing or invalid');
  const minAmountA = args.nextU256().expect('minAmountA is missing or invalid');
  const minAmountB = args.nextU256().expect('minAmountB is missing or invalid');

  _addLiquidity(amountA, amountB, minAmountA, minAmountB);
}

/**
 * Adds liquidity to the pool using MAS tokens.
 *
 * @param binaryArgs - A serialized array of bytes containing the amounts of tokens A and B.
 *  - `amountA`: The amount of token A to add to the pool.
 *  - `amountB`: The amount of token B to add to the pool.
 *
 * @remarks
 * This function wraps MAS tokens to WMAS and then adds liquidity to the pool.
 * It expects the binaryArgs to contain valid u256 values for both token amounts.
 * Throws an error if the amounts are missing or invalid.
 */
export function addLiquidityWithMas(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const aAmount = args.nextU256().expect('Amount A is missing or invalid');
  const bAmount = args.nextU256().expect('Amount B is missing or invalid');
  const minAmountA = args.nextU256().expect('minAmountA is missing or invalid');
  const minAmountB = args.nextU256().expect('minAmountB is missing or invalid');

  // Wrap MAS to WMAS
  _wrapMasToWMAS(bAmount);

  // Add liquidity with WMAS
  _addLiquidity(aAmount, bAmount, minAmountA, minAmountB, false, true);
}

/**
 * Adds liquidity to the pool by processing a request from the registry contract.
 *
 * @param binaryArgs - The serialized arguments containing the amounts of tokens A and B.
 *
 * @remarks
 * This function ensures that it is called only by the registry contract by verifying the caller's address.
 * It deserializes the token amounts from the provided binary arguments and calls the internal `_addLiquidity` function.
 * The amounts of tokens A and B must be greater than zero.
 */
export function addLiquidityFromRegistry(binaryArgs: StaticArray<u8>): void {
  // Get the registry contract address
  const registeryAddressStored = bytesToString(
    Storage.get(registryContractAddress),
  );

  // Ensure that the caller is the registry contract
  assert(
    Context.caller().toString() == registeryAddressStored,
    'Caller is not the registry contract',
  );

  const args = new Args(binaryArgs);

  let aAmount = args.nextU256().expect('Amount A is missing or invalid');
  let bAmount = args.nextU256().expect('Amount B is missing or invalid');

  const minAmountA = args.nextU256().expect('minAmountA is missing or invalid');
  const minAmountB = args.nextU256().expect('minAmountB is missing or invalid');

  // Bool args to know if the tokens are native or not
  const isNativeCoin = args
    .nextBool()
    .expect('isNativeCoin is missing or invalid');

  if (isNativeCoin) {
    _wrapMasToWMAS(bAmount);
  }

  // Call the Internal function
  _addLiquidity(aAmount, bAmount, minAmountA, minAmountB, true, isNativeCoin);
}

/**
 * Adds liquidity to the pool by transferring specified amounts of tokens A and B
 * from the user to the contract, and mints LP tokens to the user.
 *
 * @param amountA - The amount of token A to add to the pool.
 * @param amountB - The amount of token B to add to the pool.
 * @param isCalledByRegistry - Indicates if the function is called by the registry contract.
 * @param isWithMAS - Indicates if the add Liquidity is called with MAS native coin
 *
 * @remarks
 * - Ensures that both amountA and amountB are greater than zero.
 * - Normalizes the token amounts to default decimals.
 * - Calculates the optimal liquidity to mint based on current reserves.
 * - Transfers tokens from the user to the contract unless called by the registry.
 * - Updates the token reserves and generates a liquidity addition event.
 */
function _addLiquidity(
  amountA: u256,
  amountB: u256,
  minAmountA: u256,
  minAmountB: u256,
  isCalledByRegistry: bool = false,
  isWithMAS: bool = false,
): void {
  // ensure that amountA and amountB are greater than 0
  assert(amountA > u256.Zero, 'Amount A must be greater than 0');
  assert(amountB > u256.Zero, 'Amount B must be greater than 0');

  // Retrieve the token addresses from storage
  const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
  const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

  // Get the reserves of the two tokens in the pool
  const reserveA = _getLocalReserveA();
  const reserveB = _getLocalReserveB();

  // Get the total supply of the LP token
  const totalSupply: u256 = liquidityManager.getTotalSupply();

  let finalAmountA = amountA;
  let finalAmountB = amountB;
  let liquidity: u256;

  if (reserveA == u256.Zero && reserveB == u256.Zero) {
    // Initial liquidity: liquidity = sqrt(amountA * amountB)
    const product = SafeMath256.mul(amountA, amountB);
    // liquidity = sqrt(product)
    liquidity = SafeMath256.sqrt(product);
  } else {
    // Add liquidity proportionally
    // Optimal amountB given amountA:
    const amountBOptimal = SafeMath256.div(
      SafeMath256.mul(amountA, reserveB),
      reserveA,
    );
    if (amountBOptimal > amountB) {
      // User provided less B than optimal, adjust A
      const amountAOptimal = SafeMath256.div(
        SafeMath256.mul(amountB, reserveA),
        reserveB,
      );
      finalAmountA = amountAOptimal;
    } else {
      // User provided more B than needed, adjust B
      finalAmountB = amountBOptimal;
    }

    // assert that the finalAmountA and finalAmountB are greater than minAmountA and minAmountB
    assert(finalAmountA >= minAmountA, 'LESS_MIN_A_AMOUNT');
    assert(finalAmountB >= minAmountB, 'LESS_MIN_B_AMOUNT');

    // liquidity = min((finalAmountA * totalSupply / reserveA), (finalAmountB * totalSupply / reserveB))
    const liqA = SafeMath256.div(
      SafeMath256.mul(finalAmountA, totalSupply),
      reserveA,
    );
    const liqB = SafeMath256.div(
      SafeMath256.mul(finalAmountB, totalSupply),
      reserveB,
    );
    liquidity = liqA < liqB ? liqA : liqB;
  }

  assert(liquidity > u256.Zero, 'INSUFFICIENT LIQUIDITY MINTED');

  // Address of the current contract
  const contractAddress = Context.callee();

  // Address of the caller
  const callerAddress = Context.caller();

  // check if it is called by the registry
  if (!isCalledByRegistry) {
    // When the registry contract creates a new pool and adds liquidity to it at the same time,
    // it calls this `addLiquidityFromRegistry` function. In this case, we don't need to transfer tokens from the user to the contract because the amounts of tokens A and B are already transferred by the registry contract. We just need to set the local reserves of the pool and mint the corresponding amount of LP tokens to the user.

    // Transfer tokens A from user to contract
    new IMRC20(new Address(aTokenAddressStored)).transferFrom(
      callerAddress,
      contractAddress,
      finalAmountA,
    );

    if (!isWithMAS) {
      // Transfer tokens B from user to contract if this function is not called from addLiquidityWithMAS
      new IMRC20(new Address(bTokenAddressStored)).transferFrom(
        callerAddress,
        contractAddress,
        finalAmountB,
      );
    }
  }

  // Mint LP tokens to user
  liquidityManager.mint(callerAddress, liquidity);

  // Update reserves
  _updateReserveA(SafeMath256.add(reserveA, finalAmountA));
  _updateReserveB(SafeMath256.add(reserveB, finalAmountB));

  generateEvent(
    `ADD_LIQUIDITY: ${finalAmountA.toString()} of A and ${finalAmountB.toString()} of B, minted ${liquidity.toString()} LP`,
  );
}

/**
 *  Swaps tokens in the pool.
 * @param binaryArgs - Arguments serialized with Args (tokenInAddress, amountIn)
 * - `tokenInAddress`: The address of the token to swap in.
 * - `amountIn`: The amount of the token to swap in.
 * - `minAmountOut`: The minimum amount of the token to swap out.
 * @returns void
 */
export function swap(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  // Get the tokenIn address
  const tokenInAddress = args
    .nextString()
    .expect('TokenIn is missing or invalid');

  // Get the amount of tokenIn to swap
  let amountIn = args.nextU256().expect('AmountIn is missing or invalid');

  // Get the minimum amount of tokenOut
  const minAmountOut = args
    .nextU256()
    .expect('minAmountOut is missing or invalid');

  // Check if the amountIn is greater than 0
  assert(amountIn > u256.Zero, 'AmountIn must be greater than 0');

  // Check if the minAmountOut is greater than 0
  assert(minAmountOut > u256.Zero, 'minAmountOut must be greater than 0');

  // Call the internal swap function
  _swap(tokenInAddress, amountIn, minAmountOut);
}

/**
 *  Swaps Mas with the other token in the pool.
 * @returns void
 */
export function swapWithMas(binaryArgs: StaticArray<u8>): void {
  // Get the tokenIn address and amountIn from the args
  const args = new Args(binaryArgs);

  const tokenInAddress = args
    .nextString()
    .expect('TokenIn is missing or invalid');

  let amountIn = args.nextU256().expect('AmountIn is missing or invalid');

  // Get the minimum amount of tokenOut
  const minAmountOut = args
    .nextU256()
    .expect('minAmountOut is missing or invalid');

  // Check if the amountIn is greater than 0
  assert(amountIn > u256.Zero, 'AmountIn must be greater than 0');

  // Check if the minAmountOut is greater than 0
  assert(minAmountOut > u256.Zero, 'minAmountOut must be greater than 0');

  // Get the registry contract address
  const registryContractAddressStored = bytesToString(
    Storage.get(registryContractAddress),
  );

  // Get the wmas token address
  const wmasTokenAddressStored = new IRegistery(
    new Address(registryContractAddressStored),
  ).getWmasTokenAddress();

  // Check if the tokenIn or tokenOut is native Mas coin
  if (tokenInAddress == NATIVE_MAS_COIN_ADDRESS) {
    // Get the transferred coins from teh operation
    const transferredCoins = Context.transferredCoins();

    assert(
      amountIn == u256.fromU64(transferredCoins),
      'AmountIn is not equal to the transferred coins',
    );

    const wmasContract = new IWMAS(new Address(wmasTokenAddressStored));

    // Wrap mas to wmas
    wmasContract.deposit(transferredCoins);

    // Call the swap internal function
    _swap(wmasTokenAddressStored, u256.fromU64(transferredCoins), minAmountOut);
  } else {
    // Get the token addresses from storage
    const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
    const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

    // Get the other token address in the pool
    const tokenOutAddress =
      tokenInAddress == aTokenAddressStored
        ? bTokenAddressStored
        : aTokenAddressStored;

    // Ensure that the tokenOut is wmas token
    assert(
      tokenOutAddress == wmasTokenAddressStored,
      'TokenOut is not wrapped mas token',
    );

    // Call the swap internal function
    const amountOut = _swap(tokenInAddress, amountIn, minAmountOut);

    const wmasContract = new IWMAS(new Address(wmasTokenAddressStored));

    // Unwrap mas to wmas
    wmasContract.withdraw(amountOut.toU64(), Context.caller());
  }
}

/**
 * Claims accumulated protocol fees for a given token.
 * @returns void
 */
export function claimProtocolFees(): void {
  // Get the token addresses from storage
  const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
  const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

  // Get accumulated fees of the token A
  const aAccumulatedFeesStored =
    _getTokenAccumulatedProtocolFee(aTokenAddressStored);

  // Get accumulated fees of the token B
  const bAccumulatedFeesStored =
    _getTokenAccumulatedProtocolFee(bTokenAddressStored);

  assert(
    aAccumulatedFeesStored > u256.Zero || bAccumulatedFeesStored > u256.Zero,
    'No accumulated fees',
  );

  // Get the protocol fee receiver from the registry
  const protocolFeeReceiver = _getProtocolFeeReceiver();

  // Address of the caller
  const callerAddress = Context.caller();

  if (aAccumulatedFeesStored > u256.Zero) {
    // Transfer accumulated protocol fees to the protocol fee receiver (retreived from the registry contarct)
    new IMRC20(new Address(aTokenAddressStored)).transferFrom(
      callerAddress,
      protocolFeeReceiver,
      aAccumulatedFeesStored,
    );

    // Reset protocol fees for that token
    _setTokenAccumulatedProtocolFee(aTokenAddressStored, u256.Zero);
  }

  if (bAccumulatedFeesStored > u256.Zero) {
    new IMRC20(new Address(bTokenAddressStored)).transferFrom(
      callerAddress,
      protocolFeeReceiver,
      bAccumulatedFeesStored,
    );

    // Reset protocol fees for that token
    _setTokenAccumulatedProtocolFee(bTokenAddressStored, u256.Zero);
  }

  generateEvent(`Protocol fees claimed by ${callerAddress.toString()}`);
}

/**
 *  Removes liquidity from the pool.
 *  @param binaryArgs - Arguments serialized with Args (lpAmount)
 *  @returns void
 */
export function removeLiquidity(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  // Get the amount of LP tokens to remove from params
  const lpAmount = args
    .nextU256()
    .expect('LpTokenAmount is missing or invalid');

  const minAmountA = args.nextU256().expect('minAmountA is missing or invalid');

  const minAmountB = args.nextU256().expect('minAmountB is missing or invalid');

  // Ensure that the user has enough LP tokens
  assert(
    liquidityManager.getBalance(Context.caller()) >= lpAmount,
    'Not enough LP tokens',
  );

  // Get the token addresses from storage
  const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
  const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

  const totalSupply = liquidityManager.getTotalSupply();

  // Current reserves
  const reserveA = _getLocalReserveA();
  const reserveB = _getLocalReserveB();

  // amountAOut = (lpAmount * reserveA) / totalSupply
  const amountAOut = SafeMath256.div(
    SafeMath256.mul(lpAmount, reserveA),
    totalSupply,
  );

  // amountBOut = (lpAmount * reserveB) / totalSupply
  const amountBOut = SafeMath256.div(
    SafeMath256.mul(lpAmount, reserveB),
    totalSupply,
  );

  // check if the amountAOut and amountBOut are greater than or equal to minAmountA and minAmountB
  assert(
    amountAOut >= minAmountA,
    'REMOVE LIQUIDITY: SLIPPAGE_LIMIT_EXCEEDED_A',
  );

  assert(
    amountBOut >= minAmountB,
    'REMOVE LIQUIDITY: SLIPPAGE_LIMIT_EXCEEDED_B',
  );

  // Burn lp tokens
  liquidityManager.burn(Context.caller(), lpAmount);

  // Transfer tokens to user
  new IMRC20(new Address(aTokenAddressStored)).transfer(
    Context.caller(),
    amountAOut,
  );
  new IMRC20(new Address(bTokenAddressStored)).transfer(
    Context.caller(),
    amountBOut,
  );

  // Update reserves
  _updateReserveA(SafeMath256.sub(reserveA, amountAOut));
  _updateReserveB(SafeMath256.sub(reserveB, amountBOut));

  generateEvent(
    `Removed liquidity: ${lpAmount.toString()} LP burned, ${amountAOut.toString()} A and ${amountBOut.toString()} B returned`,
  );
}

/**
 *  Retrieves the swap estimation for a given input amount.
 *  @param binaryArgs - Arguments serialized with Args (tokenInAddress, amountIn)
 * @returns The estimated output amount.
 */
export function getSwapOutEstimation(
  binaryArgs: StaticArray<u8>,
): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tokenInAddress = args
    .nextString()
    .expect('TokenInAddress is missing or invalid');
  let amountIn = args.nextU256().expect('AmountIn is missing or invalid');

  const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
  const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

  // Validate tokenIn is either tokenA or tokenB
  assert(
    tokenInAddress == aTokenAddressStored ||
      tokenInAddress == bTokenAddressStored,
    'Invalid token address for input',
  );

  const tokenOutAddress =
    tokenInAddress == aTokenAddressStored
      ? bTokenAddressStored
      : aTokenAddressStored;

  // Get current reserves
  const reserveIn = _getReserve(tokenInAddress);
  const reserveOut = _getReserve(tokenOutAddress);

  // Calculate fees
  const feeRate = _getFeeRate(); // e.g. if it will be 30 it actually means 0.03% (30 / 1000)

  // totalFee = amountIn * feeRate
  const totalFee = getFeeFromAmount(amountIn, feeRate);

  // amountInAfterFee = amountIn - totalFee
  const amountInAfterFee = SafeMath256.sub(amountIn, totalFee);

  // Calculate amountOut
  const amountOut = getAmountOut(amountInAfterFee, reserveIn, reserveOut);

  return u256ToBytes(amountOut);
}

/**
 * Synchronizes the reserves of the pool with the current balances of the tokens.
 * This function ensures that the reserves are always up-to-date with the current balances of the tokens.
 * @returns void
 */
export function syncReserves(): void {
  // only owner of registery contract can call this function
  _onlyOwner();

  // get the balance of this contract for token A
  const balanceA = getTokenBalance(
    new Address(bytesToString(Storage.get(aTokenAddress))),
  );

  // get the balance of this contract for token B
  const balanceB = getTokenBalance(
    new Address(bytesToString(Storage.get(bTokenAddress))),
  );

  // update reserves
  _updateReserveA(balanceA);
  _updateReserveB(balanceB);
}

/**
 * Retrieves the balance of the LP token for a given user.
 * @param binaryArgs - Arguments serialized with Args (userAddress)
 * @returns The balance of the LP token for the given user.
 */
export function getLPBalance(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);

  const userAddress = args
    .nextString()
    .expect('UserAddress is missing or invalid');

  const balance: u256 = liquidityManager.getBalance(new Address(userAddress));

  return u256ToBytes(balance);
}

/**
 * Retrieves the local reserve of token A.
 * @returns The current reserve of token A in the pool.
 */
export function getLocalReserveA(): StaticArray<u8> {
  return Storage.get(aTokenReserve);
}

/**
 * Retrieves the local reserve of token B.
 * @returns The current reserve of token B in the pool.
 */
export function getLocalReserveB(): StaticArray<u8> {
  return Storage.get(bTokenReserve);
}

/**
 * Retrieves the last recorded cumulative price of token A from storage.
 *
 * @returns The stored cumulative price as a byte array.
 */
export function getAPriceCumulativeLast(): StaticArray<u8> {
  return Storage.get(aPriceCumulative);
}

/**
 * Retrieves the last recorded cumulative price of token B from storage.
 *
 * @returns The stored cumulative price as a byte array.
 */
export function getBPriceCumulativeLast(): StaticArray<u8> {
  return Storage.get(bPriceCumulative);
}

/**
 * Calculates the Time-Weighted Average Price (TWAP) for a given token over a specified duration.
 *
 * @param tokenInAddress - The address of the token for which the TWAP is calculated.
 * @param duration - The time period over which the TWAP is calculated, in seconds.
 * @returns The TWAP as a byte array, representing the average price of the token.
 *
 * @throws Will throw an error if the specified duration exceeds the available time since the last recorded timestamp.
 */
export function getTWAP(
  tokenInAddress: string,
  duration: u64,
): StaticArray<u8> {
  // Get the current timestamp in seconds
  const currentTimestamp = Context.timestamp();

  // Retrieve cumulative prices and timestamp
  const cumulativeA = bytesToU256(Storage.get(aPriceCumulative));
  const cumulativeB = bytesToU256(Storage.get(bPriceCumulative));
  const lastTime = bytesToU64(Storage.get(lastTimestamp));

  // Ensure duration does not exceed available time
  assert(
    currentTimestamp >= lastTime + duration,
    'Duration exceeds available time',
  );

  // Calculate TWAP
  const elapsedTime = currentTimestamp - lastTime;

  // Get the price of token A in terms of token B
  const priceA = SafeMath256.div(
    SafeMath256.sub(cumulativeA, cumulativeB),
    u256.fromU64(elapsedTime),
  );

  // Get the price of token B in terms of token A
  const priceB = SafeMath256.div(
    SafeMath256.sub(cumulativeB, cumulativeA),
    u256.fromU64(elapsedTime),
  );

  // Return the TWAP for the given token
  return tokenInAddress == bytesToString(Storage.get(aTokenAddress))
    ? u256ToBytes(priceA)
    : u256ToBytes(priceB);
}

/**
 * Retrieves the reserve of a token in the pool.
 * @param tokenAddress - The address of the token.
 * @returns The current reserve of the token in the pool.
 */
function _getReserve(tokenAddress: string): u256 {
  const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
  const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

  if (tokenAddress == aTokenAddressStored) {
    return _getLocalReserveA();
  } else if (tokenAddress == bTokenAddressStored) {
    return _getLocalReserveB();
  } else {
    return u256.Zero;
  }
}

/**
 * Retrieves the local reserve of token A.
 *
 * @returns The current reserve of token A in the pool.
 */
function _getLocalReserveA(): u256 {
  return bytesToU256(Storage.get(aTokenReserve));
}

/**
 * Retrieves the local reserve of token B.
 *
 * @returns The current reserve of token B in the pool.
 */
function _getLocalReserveB(): u256 {
  return bytesToU256(Storage.get(bTokenReserve));
}

/**
 * Retrieves the accumulated protocol fee for a token.
 * @param tokenAddress The address of the token for which to retrieve the accumulated protocol fee.
 * @returns The accumulated protocol fee for the specified token.
 */
function _getTokenAccumulatedProtocolFee(tokenAddress: string): u256 {
  const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
  const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

  if (tokenAddress == aTokenAddressStored) {
    return bytesToU256(Storage.get(aProtocolFee));
  } else if (tokenAddress == bTokenAddressStored) {
    return bytesToU256(Storage.get(bProtocolFee));
  } else {
    return u256.Zero;
  }
}

/**
 * Adds the accumulated protocol fee for a token.
 * @param tokenAddress The address of the token for which to add the accumulated protocol fee.
 * @param amount The amount of accumulated protocol fee to add.
 */
function _addTokenAccumulatedProtocolFee(
  tokenAddress: string,
  amount: u256,
): void {
  const current = _getTokenAccumulatedProtocolFee(tokenAddress);
  _setTokenAccumulatedProtocolFee(
    tokenAddress,
    SafeMath256.add(current, amount),
  );
}

/**
 * Sets the accumulated protocol fee for a given token address.
 * @param tokenAddress - The address of the token.
 * @param amount - The new amount of accumulated protocol fee for the token.
 */
function _setTokenAccumulatedProtocolFee(
  tokenAddress: string,
  amount: u256,
): void {
  const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
  const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

  if (tokenAddress == aTokenAddressStored) {
    Storage.set(aProtocolFee, u256ToBytes(amount));
  } else if (tokenAddress == bTokenAddressStored) {
    Storage.set(bProtocolFee, u256ToBytes(amount));
  }
}

/**
 * Retrieves the current fee rate for the protocol.
 *
 * @returns The current fee rate for the protocol.
 */
function _getFeeRate(): f64 {
  return bytesToF64(Storage.get(feeRate));
}

/**
 * Retrieves the current fee share for the protocol.
 *
 * @returns The current fee share for the protocol.
 */
function _getFeeShareProtocol(): f64 {
  return bytesToF64(Storage.get(feeShareProtocol));
}

/**
 * Retrieves the protocol fee receiver from the registry contract
 * @returns The protocol fee receiver address
 */
function _getProtocolFeeReceiver(): Address {
  // Get the registry contract address from storage
  const registeryAddressStored = bytesToString(
    Storage.get(registryContractAddress),
  );

  // Wrap the registry contract address in an IRegistery interface
  const registery = new IRegistery(new Address(registeryAddressStored));

  return new Address(registery.getFeeShareProtocolReceiver());
}

/**
 *  Updates the reserve of token in the pool.
 *  @param tokenAddress - The address of the token.
 *  @param amount - The new amount of token in the pool.
 *  @returns - void
 */
function _updateReserve(tokenAddress: string, amount: u256): void {
  const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
  const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

  if (tokenAddress == aTokenAddressStored) {
    _updateReserveA(amount);
  } else if (tokenAddress == bTokenAddressStored) {
    _updateReserveB(amount);
  }
}

/**
 *  Updates the reserve of token A in the pool.
 *  @param amount - The new amount of token A in the pool.
 */
function _updateReserveA(amount: u256): void {
  Storage.set(aTokenReserve, u256ToBytes(amount));
}

/**
 *  Updates the reserve of token B in the pool.
 * @param amount - The new amount of token B in the pool.
 */
function _updateReserveB(amount: u256): void {
  Storage.set(bTokenReserve, u256ToBytes(amount));
}

/**
 * Swaps tokens in the pool.
 * @param tokenInAddress - The address of the token to swap in.
 * @param amountIn - The amount of the token to swap in.
 * @param minAmountOut - The minimum amount of the token to swap out.
 * @returns The amount of the token to swap out.
 */
function _swap(
  tokenInAddress: string,
  amountIn: u256,
  minAmountOut: u256,
): u256 {
  const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
  const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

  // Check if the token address is one of the two tokens in the pool
  assert(
    tokenInAddress == aTokenAddressStored ||
      tokenInAddress == bTokenAddressStored,
    'Invalid token address',
  );

  // Calculate fees
  const feeRate = _getFeeRate(); // e.g., 0.003
  const feeShareProtocol = _getFeeShareProtocol(); // e.g., 0.05

  // totalFee = amountIn * feeRate
  const totalFee = getFeeFromAmount(amountIn, feeRate);

  // protocolFee = totalFee * feeShareProtocol
  const protocolFee = getFeeFromAmount(totalFee, feeShareProtocol);

  // lpFee = totalFee - protocolFee
  const lpFee = SafeMath256.sub(totalFee, protocolFee);

  // amountInAfterFee = amountIn - totalFee
  const amountInAfterFee = SafeMath256.sub(amountIn, totalFee);

  // Get the address of the other token in the pool
  const tokenOutAddress =
    tokenInAddress == aTokenAddressStored
      ? bTokenAddressStored
      : aTokenAddressStored;

  // Get the reserves of the two tokens in the pool
  const reserveIn = _getReserve(tokenInAddress);
  const reserveOut = _getReserve(tokenOutAddress);

  // Calculate the amount of tokens to be swapped
  const amountOut = getAmountOut(amountInAfterFee, reserveIn, reserveOut);

  // Ensure that the amountOut is greater than or equal to minAmountOut
  assert(amountOut >= minAmountOut, 'SWAP: SLIPPAGE LIMIT EXCEEDED');

  // Transfer the amountIn to the contract
  new IMRC20(new Address(tokenInAddress)).transferFrom(
    Context.caller(),
    Context.callee(),
    amountIn,
  );

  // Transfer the amountOut to the caller
  new IMRC20(new Address(tokenOutAddress)).transfer(
    Context.caller(),
    amountOut,
  );

  // Update reserves:
  // The input reserve increases by amountInAfterFee + lpFee (the portion of fees that goes to the LPs).
  // The protocolFee is not added to reserves. Instead, we store it separately.
  const newReserveIn = SafeMath256.add(
    reserveIn,
    SafeMath256.add(amountInAfterFee, lpFee),
  );
  const newReserveOut = SafeMath256.sub(reserveOut, amountOut);

  // Update the pool reserves
  _updateReserve(tokenInAddress, newReserveIn);
  _updateReserve(tokenOutAddress, newReserveOut);

  // Accumulate protocol fees
  if (protocolFee > u256.Zero) {
    _addTokenAccumulatedProtocolFee(tokenInAddress, protocolFee);
  }

  generateEvent(
    `SWAP: In=${amountIn.toString()} of ${tokenInAddress}, Out=${amountOut.toString()} of ${tokenOutAddress}, Fees: total=${totalFee.toString()}, protocol=${protocolFee.toString()}, lp=${lpFee.toString()}`,
  );

  // Update cumulative prices
  _updateCumulativePrices();

  return amountOut;
}

/**
 * Wraps a specified amount of MAS coins into WMAS tokens.
 *
 * This function ensures that the amount of MAS coins transferred is sufficient
 * before proceeding to wrap them into WMAS tokens. It retrieves the registry
 * contract address and the WMAS token address from storage, then uses these
 * addresses to create an instance of the WMAS contract. Finally, it deposits
 * the specified amount of MAS coins into the WMAS contract.
 *
 * @param amount - The amount of MAS coins to be wrapped into WMAS tokens.
 * @throws Will throw an error if the transferred MAS coins are insufficient.
 */
function _wrapMasToWMAS(amount: u256): void {
  // Get the transferred coins from the operation
  const transferredCoins = Context.transferredCoins();

  // Get the registry contract address
  const registryContractAddressStored = bytesToString(
    Storage.get(registryContractAddress),
  );

  // Get the wmas token address
  const wmasTokenAddressStored = new IRegistery(
    new Address(registryContractAddressStored),
  ).getWmasTokenAddress();

  // Get the wmas contract instance
  const wmasToken = new IWMAS(new Address(wmasTokenAddressStored));

  const mintStorageCost = u256.fromU64(
    _computeMintStorageCost(Context.callee()),
  );

  const amountToWrap = SafeMath256.add(amount, mintStorageCost);

  // Ensure bAmount is equal to MAS coins transferred
  assert(
    u256.fromU64(transferredCoins) >= amountToWrap,
    'INSUFFICIENT MAS COINS TRANSFERRED',
  );

  // Wrap MAS coins into WMAS
  wmasToken.deposit(amountToWrap.toU64());

  // Generate an event to indicate that MAS coins have been wrapped into WMAS
  generateEvent(`WRAP_MAS: ${amount.toString()} of MAS wrapped into WMAS`);
}

function _computeMintStorageCost(receiver: Address): u64 {
  const STORAGE_BYTE_COST = 100_000;
  const STORAGE_PREFIX_LENGTH = 4;
  const BALANCE_KEY_PREFIX_LENGTH = 7;

  const baseLength = STORAGE_PREFIX_LENGTH;
  const keyLength = BALANCE_KEY_PREFIX_LENGTH + receiver.toString().length;
  const valueLength = 4 * sizeof<u64>();
  return (baseLength + keyLength + valueLength) * STORAGE_BYTE_COST;
}

/**
 * Updates the cumulative prices for tokens A and B based on the elapsed time since the last update.
 *
 * This function retrieves the last stored cumulative prices and timestamp, calculates the elapsed time,
 * and updates the cumulative prices using the current reserves and elapsed time. The updated values
 * are then stored back in the storage.
 */
function _updateCumulativePrices(): void {
  // Get the current timestamp
  const currentTimestamp = Context.timestamp();

  // Retrieve last cumulative prices for tokens A and B
  const lastCumulativeA = bytesToU256(Storage.get(aPriceCumulative));
  const lastCumulativeB = bytesToU256(Storage.get(bPriceCumulative));

  // Retrieve the last timestamp from storage
  const lastTime = bytesToU64(Storage.get(lastTimestamp));

  // Calculate elapsed time
  const elapsedTime = currentTimestamp - lastTime;

  if (elapsedTime > 0) {
    // Get Local reserves for tokens A and B
    const reserveA = _getLocalReserveA();
    const reserveB = _getLocalReserveB();

    // Update cumulative prices
    const newCumulativeA = SafeMath256.add(
      lastCumulativeA,
      SafeMath256.mul(reserveB, u256.fromU64(elapsedTime)),
    );

    const newCumulativeB = SafeMath256.add(
      lastCumulativeB,
      SafeMath256.mul(reserveA, u256.fromU64(elapsedTime)),
    );

    // Store updated values
    Storage.set(aPriceCumulative, u256ToBytes(newCumulativeA));
    Storage.set(bPriceCumulative, u256ToBytes(newCumulativeB));

    // Update last timestamp
    Storage.set(lastTimestamp, u64ToBytes(currentTimestamp));
  }
}

export function flashSwap(binaryArgs: StaticArray<u8>): void {
  // read args
  const args = new Args(binaryArgs);

  const aAmountOut = args.nextU256().expect('aAmountOut is missing or invalid');
  const bAmountOut = args.nextU256().expect('bAmountOut is missing or invalid');

  // Is the smart contract address that will use the borrowed tokens
  const callbackAddress = args
    .nextString()
    .expect('callbackAddress is missing or invalid');

  // Is the data that will be passed to the callback function
  const callbackData = args
    .nextBytes()
    .expect('callbackData is missing or invalid');

  // Enusre that bAmountOut or aAmountOut is greater than 0
  assert(
    bAmountOut > u256.Zero || aAmountOut > u256.Zero,
    'FLASH_SWAP_ERROR: AMOUNTS MUST BE GREATER THAN 0',
  );

  // Ensure that the callback address is a smart contract address
  assertIsSmartContract(callbackAddress);

  // Ensure that the callback data is not empty
  assert(
    callbackData.length > 0,
    'FLASH_SWAP_ERROR: CALLBACK DATA MUST NOT BE EMPTY',
  );

  // Get the stored token addresses
  const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
  const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

  // Ensure that the callbackAddress is not one of the two tokens in the pool
  assert(
    callbackAddress != aTokenAddressStored &&
      callbackAddress != bTokenAddressStored,
    'FLASH_SWAP_ERROR: INVALID_CALLBACK_ADDRESS',
  );

  // Get the pool reserves
  const aReserve = _getLocalReserveA();
  const bReserve = _getLocalReserveB();

  // Get the pool K value that will be used later to ensure that the flash swap is valid
  const poolK = SafeMath256.mul(aReserve, bReserve);

  // Get the pool fee rate
  const poolFeeRate = _getFeeRate();

  // Ensure that the pool reserves are greater than the amounts to be swapped
  assert(
    aReserve > aAmountOut || bReserve > bAmountOut,
    'FLASH_SWAP_ERROR: INSUFFICIENT_LIQUIDITY',
  );

  // Get the token instances
  const aToken = new IMRC20(new Address(aTokenAddressStored));
  const bToken = new IMRC20(new Address(bTokenAddressStored));

  //Initialize the contract balances for token A and B
  let aContractBalance: u256;
  let bContractBalance: u256;

  if (aAmountOut > u256.Zero) {
    // Transfer aAmountOut from the contract to the callbackAddress
    aToken.transfer(new Address(callbackAddress), aAmountOut);
  }

  if (bAmountOut > u256.Zero) {
    // Transfer bAmountOut from the contract to the callbackAddress
    bToken.transfer(new Address(callbackAddress), bAmountOut);
  }

  // Call the callback function of the contract
  new IEagleCallee(new Address(callbackAddress)).eagleCall(
    Context.caller(),
    aAmountOut,
    bAmountOut,
    callbackData,
  );

  const contractAddress = Context.callee();

  // Update contract balances
  aContractBalance = aToken.balanceOf(contractAddress);
  bContractBalance = bToken.balanceOf(contractAddress);

  // Calculate aAmountIn
  // This calculation determines how much of token A was effectively returned to the contract
  // after the callback function was executed.
  //
  // Explanation:
  // 1. `aReserve - aAmountOut`: This is the expected balance of token A in the contract
  //    after the flash loan, assuming no tokens were returned.
  // 2. `aContractBalance > aReserve - aAmountOut`: This checks if the actual balance of token A in the contract after the callback is greater than the expected balance.
  // 3. If the condition is true, it means tokens were returned:
  //    `aContractBalance - (aReserve - aAmountOut)` calculates the difference, which is the
  //    amount of token A that was returned (aAmountIn).
  // 4. If the condition is false, it means no tokens were returned or the contract's balance
  //    is less than the expected balance, so `aAmountIn` is set to 0.
  const aAmountIn: u256 =
    aContractBalance > SafeMath256.sub(aReserve, aAmountOut)
      ? SafeMath256.sub(aContractBalance, SafeMath256.sub(aReserve, aAmountOut))
      : u256.Zero;

  // Same as aAmountIn but for token B
  const bAmountIn: u256 =
    bContractBalance > SafeMath256.sub(bReserve, bAmountOut)
      ? SafeMath256.sub(bContractBalance, SafeMath256.sub(bReserve, bAmountOut))
      : u256.Zero;

  // Ensure that aAmountIn or bAmountIn is greater than 0
  assert(
    aAmountIn > u256.Zero || bAmountIn > u256.Zero,
    'FLASH_SWAP_ERROR: INSUFFICIENT_INPUT_AMOUNT',
  );

  // Remove fees from the balances
  const aBalanceAdjusted = SafeMath256.sub(
    SafeMath256.mul(aContractBalance, u256.fromU64(HUNDRED_PERCENT)),
    SafeMath256.mul(aAmountIn, u256.fromF64(poolFeeRate)),
  );

  const bBalanceAdjusted = SafeMath256.sub(
    SafeMath256.mul(bContractBalance, u256.fromU64(HUNDRED_PERCENT)),
    SafeMath256.mul(bAmountIn, u256.fromF64(poolFeeRate)),
  );

  // Ensure the new k value is greater or equal to the pool K value
  assert(
    SafeMath256.mul(aBalanceAdjusted, bBalanceAdjusted) >=
      SafeMath256.mul(poolK, u256.fromU64(1000 ** 2)), // Scale poolK by 1000^2 because aBalanceAdjusted and bBalanceAdjusted are scaled by 1000
    'FLASH_SWAP_ERROR: K_VALUE_TOO_LOW',
  );

  // Update the reserves of the pool
  _updateReserveA(aContractBalance);
  _updateReserveB(bContractBalance);

  // Update the cumulative prices
  _updateCumulativePrices();

  generateEvent(
    `FLASH_SWAP: User ${Context.caller()} executed a flash swap. he swapped ${aAmountIn} ${aTokenAddressStored} for ${bAmountOut} ${bTokenAddressStored} and ${aAmountOut} ${aTokenAddressStored} for ${bAmountIn} ${bTokenAddressStored}.`,
  );
}

// Export ownership functions
export * from '../utils/ownership';
