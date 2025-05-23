// This smart contract implements a liquidity pool for trading two MRC-20 tokens on the Massa blockchain.
// **IMPORTANT**: This pool **only accepts MRC-20 tokens**. To use the native MAS coin, it must be **wrapped to WMAS** first.
//  (MAS -> WMAS: native MAS must be wrapped into MRC-20 WMAS via a wrapping contract to be used in this pool).
import {
  Context,
  generateEvent,
  Storage,
  Address,
  assertIsSmartContract,
  balance,
  validateAddress,
  createEvent,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  bytesToString,
  bytesToU256,
  bytesToU32,
  bytesToU64,
  stringToBytes,
  u256ToBytes,
  u32ToBytes,
  u64ToBytes,
} from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';
import { IMRC20 } from '../interfaces/IMRC20';
import { getAmountOut, getFeeFromAmount } from '../lib/basicPoolMath';
import { IRegistery } from '../interfaces/IRegistry';
import { SafeMath256 } from '../lib/safeMath';
import {
  LiquidityManager,
  StoragePrefixManager,
} from '../lib/liquidityManager';
import { IWMAS } from '@massalabs/sc-standards/assembly/contracts/MRC20/IWMAS';
import { IEagleCallee } from '../interfaces/IEagleCallee';
import {
  _computeMintStorageCost,
  getTokenBalance,
  transferRemaining,
} from '../utils';
import { ReentrancyGuard } from '../lib/ReentrancyGuard';
import {
  addLiquidityData,
  GetLiquidityDataResult,
  GetSwapOutResult,
} from '../types/basicPool';
import { getBalanceEntryCost } from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20-external';
import { denormalizeFromDecimals, normalizeToDecimals } from '../lib/math';
import { safetyFactor } from '../utils/constants';

// Storage key containing the value of the token A reserve inside the pool
export const aTokenReserve = stringToBytes('aTokenReserve');
// Storage key containing the value of the token B reserve inside the pool
export const bTokenReserve = stringToBytes('bTokenReserve');
// Storage key containing address of the token A inside the pool
export const aTokenAddress = stringToBytes('tokenA');
// storage key containing address of the token B inside the pool
export const bTokenAddress = stringToBytes('tokenB');
// Storage key containing the accumulated fee protocol of the token A inside the pool
export const aProtocolFee = stringToBytes('aProtocolFee');
// Storage key containing the accumulated fee protocol of the token B inside the pool
export const bProtocolFee = stringToBytes('bProtocolFee');
// Storage key containing the fee rate value of the pool. value is between 0 and 1
export const feeRate = stringToBytes('feeRate');
// Storage key containing the fee share protocol value of the pool. value is between 0 and 1
export const feeShareProtocol = stringToBytes('feeShareProtocol');
// Storage key containing the address of the registry contract inside the pool
export const registryContractAddress = stringToBytes('registry');
// Create new liquidity manager representing the pool LP token
const storagePrefixManager = new StoragePrefixManager();
const liquidityManager = new LiquidityManager<u256>(storagePrefixManager);
// Storage keys for cumulative prices
export const aPriceCumulative = stringToBytes('aPriceCumulative');
export const bPriceCumulative = stringToBytes('bPriceCumulative');
// Storage key for last timestamp
export const lastTimestamp = stringToBytes('lastTimestamp');
// Storage key containing the flash loan fee value of the pool. value is between 0 and 1
export const flashLoanFee = stringToBytes('flashLoanFee');
// Storage key containing the decimals of the token A inside the pool
export const aTokenDecimals = stringToBytes('aTokenDecimals');
// Storage key containing the decimals of the token B inside the pool
export const bTokenDecimals = stringToBytes('bTokenDecimals');

// Variable representing the number of decimals used for normalization and denormalization in that pool. by default it is 18, but it will be changed at the constructor with the max decimals between the two tokens
let normalizationDecimals = 18;

/**
 * This function is meant to be called only one time: when the contract is deployed.
 * @param binaryArgs - Arguments serialized with Args
 * - `aAddress`: Address of token A.
 * - `bAddress`: Address of token B.
 * - `inputFeeRate`: Input fee rate for the pool.
 * - `feeShareProtocol`: Fee share protocol for the pool.
 * - `flashLoanFee`: Flash loan fee for the pool.
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
    .nextU64()
    .expect('Input fee rate is missing or invalid');

  const feeShareProtocolInput = args
    .nextU64()
    .expect('Fee share protocol is missing or invalid');

  const flashLoanFeeInput = args
    .nextU64()
    .expect('Flash loan fee is missing or invalid');

  const registryAddress = args
    .nextString()
    .expect('RegistryAddress is missing or invalid');

  // We already checking if address A, address B, fee rate, and fee share protocol are valid in the registry

  // ensure that the registryAddress is a valid smart contract address
  assertIsSmartContract(registryAddress);

  // Store fee rate
  Storage.set(feeRate, u64ToBytes(inputFeeRate));

  // Store fee share protocol
  Storage.set(feeShareProtocol, u64ToBytes(feeShareProtocolInput));

  // Store flash loan fee
  Storage.set(flashLoanFee, u64ToBytes(flashLoanFeeInput));

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

  // Set the default prices to zero
  Storage.set(aPriceCumulative, u256ToBytes(u256.Zero));
  Storage.set(bPriceCumulative, u256ToBytes(u256.Zero));

  // Set the current timestamp
  Storage.set(lastTimestamp, u64ToBytes(Context.timestamp()));

  // Get a and b tokens decimals
  const aTokenDecimalsIn = new IMRC20(new Address(aAddress)).decimals();
  const bTokenDecimalsIn = new IMRC20(new Address(bAddress)).decimals();

  // Store the tokens a and b decimals
  Storage.set(aTokenDecimals, u32ToBytes(aTokenDecimalsIn));
  Storage.set(bTokenDecimals, u32ToBytes(bTokenDecimalsIn));

  // extract the max decimals and min decimals between the two tokens
  const maxDecimals =
    aTokenDecimalsIn > bTokenDecimalsIn ? aTokenDecimalsIn : bTokenDecimalsIn;
  const minDecimals =
    aTokenDecimalsIn < bTokenDecimalsIn ? aTokenDecimalsIn : bTokenDecimalsIn;

  const decimalsDifference = maxDecimals - minDecimals;

  // Compare the decimals of the two tokens and ensure that its difference is less than 12
  assert(decimalsDifference <= 12, 'DECIMALS_DIFFERENCE_TOO_LARGE');

  // Set the normalization decimals to the max decimals
  normalizationDecimals = maxDecimals;

  // Initialize the reentrancy guard
  ReentrancyGuard.__ReentrancyGuard_init();

  // Emit an event
  generateEvent(
    createEvent('UPDATE_CUMULATIVE_PRICES:', [
      Context.callee().toString(), // Smart contract address
      Context.caller().toString(), // Caller address
      '0', // A Comulative price
      '0', // B Comulative price
      Context.timestamp().toString(), // Current timestamp
    ]),
  );
}

/**
 *  Adds liquidity to the pool.
 *  @param binaryArgs - Arguments serialized with Args
 *  - `amountA`: The amount of token A to add to the pool.
 *  - `amountB`: The amount of token B to add to the pool.
 *  - `minAmountA`: The minimum amount of token A to add to the pool.
 *  - `minAmountB`: The minimum amount of token B to add to the pool.
 * @returns void
 */
export function addLiquidity(binaryArgs: StaticArray<u8>): void {
  // Start reentrancy guard
  ReentrancyGuard.nonReentrant();

  const args = new Args(binaryArgs);

  let amountA = args.nextU256().expect('Amount A is missing or invalid');
  let amountB = args.nextU256().expect('Amount B is missing or invalid');
  const minAmountA = args.nextU256().expect('minAmountA is missing or invalid');
  const minAmountB = args.nextU256().expect('minAmountB is missing or invalid');

  // Get the current balance of the smart contract
  const SCBalance = balance();
  // Get the coins transferred to the smart contract
  const sent = Context.transferredCoins();

  const result = _addLiquidity(amountA, amountB, minAmountA, minAmountB);

  // Transfer the remaining balance of the smart contract to the caller
  transferRemaining(SCBalance, balance(), sent, Context.caller());

  // End reentrancy guard
  ReentrancyGuard.endNonReentrant();

  // Emit event
  generateEvent(
    createEvent('ADD_LIQUIDITY', [
      result.contractAddress, // Smart contract address
      result.callerAddress, // Caller address
      result.finalAmountA.toString(), // A amount
      result.finalAmountB.toString(), // B amount
      result.liquidity.toString(), // Minted LP amount
      result.newResA.toString(), // New reserve A
      result.newResB.toString(), // New reserve B
    ]),
  );
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
  // Start reentrancy guard
  ReentrancyGuard.nonReentrant();

  const args = new Args(binaryArgs);

  const aAmount = args.nextU256().expect('Amount A is missing or invalid');
  const bAmount = args.nextU256().expect('Amount B is missing or invalid');
  const minAmountA = args.nextU256().expect('minAmountA is missing or invalid');
  const minAmountB = args.nextU256().expect('minAmountB is missing or invalid');

  // Get the current balance of the smart contract
  const SCBalance = balance();
  // Get the coins transferred to the smart contract
  const sent = Context.transferredCoins();

  // Wrap MAS to WMAS
  _wrapMasToWMAS(bAmount);

  // Add liquidity with WMAS
  const result = _addLiquidity(
    aAmount,
    bAmount,
    minAmountA,
    minAmountB,
    false,
    true,
  );

  // Transfer Remainning coins
  transferRemaining(SCBalance, balance(), sent, Context.caller());

  // End reentrancy guard
  ReentrancyGuard.endNonReentrant();

  // Emit event
  generateEvent(
    createEvent('ADD_LIQUIDITY', [
      result.contractAddress, // Smart contract address
      result.callerAddress, // Caller address
      result.finalAmountA.toString(), // A amount
      result.finalAmountB.toString(), // B amount
      result.liquidity.toString(), // Minted LP amount
      result.newResA.toString(), // New reserve A
      result.newResB.toString(), // New reserve B
    ]),
  );
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
  // Start reentrancy guard
  ReentrancyGuard.nonReentrant();

  // Get the current balance of the smart contract
  const SCBalance = balance();
  // Get the coins transferred to the smart contract
  const sent = Context.transferredCoins();

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

  const callerAddress = args
    .nextString()
    .expect('Caller is missing or invalid');

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
  _addLiquidity(
    aAmount,
    bAmount,
    minAmountA,
    minAmountB,
    true,
    isNativeCoin,
    new Address(callerAddress),
  );

  // Transfer the remaining coins to the caller
  transferRemaining(SCBalance, balance(), sent, new Address(callerAddress));

  // End reentrancy guard
  ReentrancyGuard.endNonReentrant();
}

/**
 * Estimates the liquidity pool (LP) tokens to be received when adding liquidity.
 *
 * @param binaryArgs - A serialized array of bytes containing the amounts of token A and token B to add.
 * - amountA - The amount of token A to add.
 * - amountB - The amount of token B to add.
 * @returns The estimated amount of LP tokens.
 * @throws Will throw an error if the amounts of token A or token B are missing or invalid.
 */
export function getAddLiquidityLPEstimation(binaryArgs: StaticArray<u8>): u256 {
  const args = new Args(binaryArgs);

  // get the amount of token A to add
  const amountA = args.nextU256().expect('AmountA is missing or invalid');

  // get the amount of token B to add
  const amountB = args.nextU256().expect('AmountB is missing or invalid');

  // Get the liquidity data for adding liquidity
  const liquidityData = _getAddLiquidityData(
    amountA,
    amountB,
    u256.Zero,
    u256.Zero,
  );

  // Return the liquidity amount
  return liquidityData.liquidity;
}

/**
 *  Swaps tokens in the pool. This function call is limited to a specific caller which is the swap Router Getted from the registry contract.
 * @param binaryArgs - Arguments serialized with Args (tokenInAddress, amountIn)
 * - `tokenInAddress`: The address of the token to swap in.
 * - `amountIn`: The amount of the token to swap in.
 * - `minAmountOut`: The minimum amount of the token to swap out.
 * @returns void
 */
export function swap(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  // Start reentrancy guard
  ReentrancyGuard.nonReentrant();

  // Get the current balance of the smart contract
  const SCBalance = balance();
  // Get the coins transferred to the smart contract
  const sent = Context.transferredCoins();

  // Get the registry contract address
  const registeryAddressStored = bytesToString(
    Storage.get(registryContractAddress),
  );

  // Ensure that the caller is the Swap Router stored in the registry contract
  const registry = new IRegistery(new Address(registeryAddressStored));

  // Get the swap router address from registry contract
  const swapRouterAddress = registry.getSwapRouterAddress();

  // Ensure that the caller is the swap router stored in the registry contract
  assert(
    Context.caller() == swapRouterAddress,
    'Caller is not the swap router stored in the registry.',
  );

  const args = new Args(binaryArgs);

  // Get the tokenIn address
  const tokenInAddress = args
    .nextString()
    .expect('TokenIn is missing or invalid');

  // Get the amount of tokenIn to swap
  const amountIn = args.nextU256().expect('AmountIn is missing or invalid');

  // Get the minimum amount of tokenOut
  const minAmountOut = args
    .nextU256()
    .expect('minAmountOut is missing or invalid');

  // The address to transfer the swapped tokens to
  const toAddress = new Address(
    args.nextString().expect('ToAddress is missing or invalid'),
  );

  // The address of user that initiated the swap operation
  const originalCaller = args
    .nextString()
    .expect('originalCaller is missing or invalid');

  // Bool args to know if the tokenOut is native or not
  const isTokenOutNative = args
    .nextBool()
    .expect('isTokenOutNative is missing or invalid');

  const swapOutData = _getSwapOut(amountIn, tokenInAddress);

  const amountOut = swapOutData.amountOut;
  const tokenOutAddress = swapOutData.tokenOutAddress;
  const reserveIn = swapOutData.reserveIn;
  const reserveOut = swapOutData.reserveOut;
  const totalFee = swapOutData.totalFee;
  const lpFee = swapOutData.lpFee;
  const protocolFee = swapOutData.protocolFee;
  const amountInAfterFee = swapOutData.amountInAfterFee;
  const normAmountInAfterFee = swapOutData.normAmountInAfterFee;
  const normReserveIn = swapOutData.normReserveIn;
  const normReserveOut = swapOutData.normReserveOut;
  const normAmountOut = swapOutData.normAmountOut;
  const inDecimals = swapOutData.inDecimals;
  const outDecimals = swapOutData.outDecimals;

  // Get the balance of the smart contract for the tokenIn
  const contractInBalance = new IMRC20(new Address(tokenInAddress)).balanceOf(
    Context.callee(),
  );

  // Ensure that the balance of the smart contract of tokenIn is greater than or equal to the reserveIn + amountIn
  assert(
    contractInBalance >= SafeMath256.add(reserveIn, amountIn),
    'SWAP: INSUFFICIENT_IN_SEND',
  );

  // Ensure that the amountOut is greater than or equal to minAmountOut
  assert(amountOut >= minAmountOut, 'SWAP: SLIPPAGE_LIMIT_EXCEEDED');

  if (!isTokenOutNative) {
    // Transfer the amountOut to the toAddres
    new IMRC20(new Address(tokenOutAddress)).transfer(
      toAddress,
      amountOut,
      getBalanceEntryCost(tokenOutAddress, toAddress.toString()),
    );
  } else {
    // unwrap the amountOut to MAs then transfer to the to address
    _unwrapWMASToMas(amountOut, toAddress);
  }

  // Update reserves:
  // The input reserve increases by amountInAfterFee + lpFee (the portion of fees that goes to the LPs).
  // The protocolFee is not added to reserves. Instead, we store it separately.
  const newReserveIn = SafeMath256.add(
    reserveIn,
    SafeMath256.add(amountInAfterFee, lpFee),
  );

  const newReserveOut = SafeMath256.sub(reserveOut, amountOut);

  // K value invarient check before updating the reserves
  // newK = (reserveIn + amountInAfterFee + lpFee) * (reserveOut - amountOut)
  const newK = SafeMath256.mul(
    normalizeToDecimals(newReserveIn, inDecimals, normalizationDecimals),
    normalizeToDecimals(newReserveOut, outDecimals, normalizationDecimals),
  );
  // oldK = reserveIn * reserveOut
  const oldK = SafeMath256.mul(normReserveIn, normReserveOut);

  // Final K-value invariant check
  assert(newK >= oldK, 'SWAP: INVARIENT_CHECK_FAILED_K');

  // Update the pool reserves
  _updateReserve(tokenInAddress, newReserveIn);
  _updateReserve(tokenOutAddress, newReserveOut);

  // Accumulate protocol fees
  if (protocolFee > u256.Zero) {
    _addTokenAccumulatedProtocolFee(tokenInAddress, protocolFee);
  }

  // Update cumulative prices
  _updateCumulativePrices();

  generateEvent(
    createEvent('SWAP', [
      Context.callee().toString(), // Smart Contract Address
      originalCaller, // Caller Address
      amountIn.toString(), // Amount In
      tokenInAddress, // Token In Address
      amountOut.toString(), // Amount Out
      tokenOutAddress, // Token Out Address
      totalFee.toString(), // Total Fee
      protocolFee.toString(), // Protocol Fee
      lpFee.toString(), // LP Fee
      newReserveIn.toString(), // New Reserve In
      newReserveOut.toString(), // New Reserve Out
    ]),
  );

  transferRemaining(SCBalance, balance(), sent, Context.caller());

  // End reentrancy guard
  ReentrancyGuard.endNonReentrant();

  return u256ToBytes(amountOut);
}

/**
 * Claims accumulated protocol fees for a given token.
 * This function can be called by anyone but
 * @returns void
 */
export function claimProtocolFees(_: StaticArray<u8>): void {
  // Start reentrancy guard
  ReentrancyGuard.nonReentrant();

  // Get the current balance of the smart contract
  const SCBalance = balance();
  // Get the coins transferred to the smart contract
  const sent = Context.transferredCoins();

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
    new IMRC20(new Address(aTokenAddressStored)).transfer(
      protocolFeeReceiver,
      aAccumulatedFeesStored,
      getBalanceEntryCost(aTokenAddressStored, protocolFeeReceiver.toString()),
    );

    // Reset protocol fees for that token
    _setTokenAccumulatedProtocolFee(aTokenAddressStored, u256.Zero);
  }

  if (bAccumulatedFeesStored > u256.Zero) {
    new IMRC20(new Address(bTokenAddressStored)).transfer(
      protocolFeeReceiver,
      bAccumulatedFeesStored,
      getBalanceEntryCost(bTokenAddressStored, protocolFeeReceiver.toString()),
    );

    // Reset protocol fees for that token
    _setTokenAccumulatedProtocolFee(bTokenAddressStored, u256.Zero);
  }

  // Transfer remaining balance to the caller
  transferRemaining(SCBalance, balance(), sent, callerAddress);

  // End reentrancy guard
  ReentrancyGuard.endNonReentrant();

  generateEvent(
    createEvent('CLAIM_PROTOCOL_FEE', [
      Context.callee().toString(), // Smart contract address
      callerAddress.toString(), // Caller address
      aAccumulatedFeesStored.toString(), // Amount of token A Claimed
      bAccumulatedFeesStored.toString(), // Amount of token B Claimed
      protocolFeeReceiver.toString(), // Protocol fee receiver address
    ]),
  );
}

/**
 *  Removes liquidity from the pool.
 *  @param binaryArgs - Arguments serialized with Args (lpAmount)
 *  @returns void
 */
export function removeLiquidity(binaryArgs: StaticArray<u8>): void {
  // Start reentrancy guard
  ReentrancyGuard.nonReentrant();

  // Get the current balance of the smart contract
  const SCBalance = balance();
  // Get the coins transferred to the smart contract
  const sent = Context.transferredCoins();

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

  // get the current caller address
  const callerAddress = Context.caller();

  // Current reserves
  const reserveA = _getLocalReserveA();
  const reserveB = _getLocalReserveB();

  // Get the decimals of the two tokens in the pool
  const aDecimalsStored = bytesToU32(Storage.get(aTokenDecimals));
  const bDecimalsStored = bytesToU32(Storage.get(bTokenDecimals));

  // Normalize reserves for proper proportional math.
  const normReserveA = normalizeToDecimals(
    reserveA,
    aDecimalsStored,
    normalizationDecimals,
  );
  const normReserveB = normalizeToDecimals(
    reserveB,
    bDecimalsStored,
    normalizationDecimals,
  );

  // amountAOut = (lpAmount * reserveA) / totalSupply
  const normAmountAOut = SafeMath256.div(
    SafeMath256.mul(lpAmount, normReserveA),
    totalSupply,
  );

  const amountAOut = denormalizeFromDecimals(
    normAmountAOut,
    aDecimalsStored,
    normalizationDecimals,
  );

  // amountBOut = (lpAmount * reserveB) / totalSupply
  const normAmountBOut = SafeMath256.div(
    SafeMath256.mul(lpAmount, normReserveB),
    totalSupply,
  );
  const amountBOut = denormalizeFromDecimals(
    normAmountBOut,
    bDecimalsStored,
    normalizationDecimals,
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

  // Transfer tokens to user
  new IMRC20(new Address(aTokenAddressStored)).transfer(
    callerAddress,
    amountAOut,
    getBalanceEntryCost(aTokenAddressStored, callerAddress.toString()),
  );
  new IMRC20(new Address(bTokenAddressStored)).transfer(
    callerAddress,
    amountBOut,
    getBalanceEntryCost(bTokenAddressStored, callerAddress.toString()),
  );

  // Burn lp tokens
  liquidityManager.burn(callerAddress, lpAmount);

  const newResA = SafeMath256.sub(reserveA, amountAOut);
  const newResB = SafeMath256.sub(reserveB, amountBOut);

  // Update reserves
  _updateReserveA(newResA);
  _updateReserveB(newResB);

  // Transfer remaining coins to the caller
  transferRemaining(SCBalance, balance(), sent, callerAddress);

  // End reentrancy guard
  ReentrancyGuard.endNonReentrant();

  // Emit event
  generateEvent(
    createEvent('REMOVE_LIQUIDITY', [
      Context.callee().toString(), // Smart contract address
      Context.caller().toString(), // Caller address
      lpAmount.toString(), // Amount of LP tokens burned
      amountAOut.toString(), // Amount of token A out
      amountBOut.toString(), // Amount of token B out
      newResA.toString(), // New reserve of token A
      newResB.toString(), // New reserve of token B
    ]),
  );
}

/**
 * Synchronizes the reserves of the pool with the current balances of the tokens.
 * This function ensures that the reserves are always up-to-date with the current balances of the tokens.
 * @returns void
 */
export function syncReserves(): void {
  // Start reentrancy guard
  ReentrancyGuard.nonReentrant();

  const SCBalance = balance();
  const sent = Context.transferredCoins();

  // only owner of registery contract can call this function
  _onlyRegistryOwner();

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

  // Update cumulative prices
  _updateCumulativePrices();

  // Transfer remaining coins to the caller
  transferRemaining(SCBalance, balance(), sent, Context.caller());

  // End reentrancy guard
  ReentrancyGuard.endNonReentrant();

  // Emit an event
  generateEvent(
    createEvent('SYNC_RESERVES', [
      Context.callee().toString(), // Smart contract address
      Context.caller().toString(), // Caller address
      balanceA.toString(), // New reserve of token A
      balanceB.toString(), // New reserve of token B
    ]),
  );
}

/**
 * Executes a flash loan operation, allowing a user or smart contract to borrow tokens
 * from the pool and return them in the same transaction, potentially profiting from
 * arbitrage opportunities.
 *
 * @param binaryArgs - A serialized array of bytes containing the input arguments for the flash loan.
 *  - `aAmount`: The amount of token A to swap in.
 *  - `bAmount`: The amount of token B to swap in.
 *  - `profitAddress`: The address of the profit to be received.
 *  - `callbackData`: The data to be passed to the callback function.
 *
 * @throws Will throw an error if any of the following conditions are not met:
 * - `aAmount` or `bAmount` is missing or invalid.
 * - `profitAddress` is missing or invalid.
 * - `callbackData` is missing or invalid.
 * - The callback address is not a smart contract.
 * - The profit address is invalid.
 * - Both `aAmount` and `bAmount` are zero.
 * - The callback address is one of the token addresses in the pool.
 * - Insufficient liquidity in the pool.
 * - The returned token amounts after the callback do not match the expected values.
 * - The new pool K value is less than the old pool K value.
 *
 * The function performs the following steps:
 * - Deserializes input arguments.
 * - Validates the callback and profit addresses.
 * - Transfers the specified token amounts to the callback address.
 * - Invokes the callback function on the specified smart contract.
 * - Validates the returned token balances and calculates fees.
 * - Updates the pool reserves and cumulative prices.
 * - Generates events for the old and new pool K values and the flash loan execution.
 */
export function flashLoan(binaryArgs: StaticArray<u8>): void {
  // Start reentrancy guard
  ReentrancyGuard.nonReentrant();

  // read args
  const args = new Args(binaryArgs);

  const aAmount = args.nextU256().expect('aAmount is missing or invalid');
  const bAmount = args.nextU256().expect('bAmount is missing or invalid');

  // Address of the user or the smart contract that will receive the profit
  const profitAddress = args
    .nextString()
    .expect('profitAddress is missing or invalid');

  const callbackData = args
    .nextBytes()
    .expect('callbackData is missing or invalid');

  // Coins to be transferred to the callback address
  const callbackCoins = args.nextU64().unwrapOrDefault();

  // The current caller is the callback address which should be a smart contract
  const callbackAddress = Context.caller();

  // Get the current balance of the smart contract
  const SCBalance = balance();
  // Get the coins transferred to the smart contract
  const sent = Context.transferredCoins();

  // Ensure that the callback address is a smart contract
  assertIsSmartContract(callbackAddress.toString());

  // Ensure that the profit address is a valid address
  assert(validateAddress(profitAddress), 'INVALID PROFIT ADDRESS');

  // Enusre that bAmount or aAmount is greater than 0
  assert(
    bAmount > u256.Zero || aAmount > u256.Zero,
    'FLASH_ERROR: AMOUNTS MUST BE GREATER THAN 0',
  );

  // Get the stored token addresses
  const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
  const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

  // Ensure that the callbackAddress is not one of the two tokens in the pool
  assert(
    callbackAddress.toString() != aTokenAddressStored &&
      callbackAddress.toString() != bTokenAddressStored,
    'FLASH_ERROR: INVALID_CALLBACK_ADDRESS',
  );

  // Get the pool reserves
  const aReserve = _getLocalReserveA();
  const bReserve = _getLocalReserveB();

  // Get the decimals of the two tokens in the pool
  let aDecimalsStored = bytesToU32(Storage.get(aTokenDecimals));
  let bDecimalsStored = bytesToU32(Storage.get(bTokenDecimals));

  // Get the pool K value that will be used later to ensure that the flash loan is valid
  const poolK = SafeMath256.mul(
    normalizeToDecimals(aReserve, aDecimalsStored, normalizationDecimals),
    normalizeToDecimals(bReserve, bDecimalsStored, normalizationDecimals),
  );

  // Get the pool flash loan fee
  const poolFeeRate = _getFlashLoanFee();

  // Ensure that the pool reserves are greater or equals than the amounts to be loaned
  assert(
    aReserve >= aAmount && bReserve >= bAmount,
    'FLASH_ERROR: INSUFFICIENT_LIQUIDITY',
  );

  // Get the current contract address
  const contractAddress = Context.callee();

  // Get the token instances
  const aToken = new IMRC20(new Address(aTokenAddressStored));
  const bToken = new IMRC20(new Address(bTokenAddressStored));

  // Get the contract balances before the swap
  const aContractBalanceBefore = aToken.balanceOf(contractAddress);
  const bContractBalanceBefore = bToken.balanceOf(contractAddress);

  // Transfer the amounts to the callback address
  if (aAmount > u256.Zero) {
    // Transfer aAmount from the contract to the callbackAddress
    aToken.transfer(
      callbackAddress,
      aAmount,
      getBalanceEntryCost(aTokenAddressStored, callbackAddress.toString()),
    );
  }

  if (bAmount > u256.Zero) {
    // Transfer bAmount from the contract to the callbackAddress
    bToken.transfer(
      callbackAddress,
      bAmount,
      getBalanceEntryCost(bTokenAddressStored, callbackAddress.toString()),
    );
  }

  // Call the callback function of the contract
  new IEagleCallee(callbackAddress).eagleCall(
    new Address(profitAddress),
    aAmount,
    bAmount,
    callbackData,
    callbackCoins,
  );

  // get contract tokens balance after callback
  const aContractBalanceAfter = aToken.balanceOf(contractAddress);
  const bContractBalanceAfter = bToken.balanceOf(contractAddress);

  // Get Fees from the amounts
  const aFee = getFeeFromAmount(aAmount, poolFeeRate);
  const bFee = getFeeFromAmount(bAmount, poolFeeRate);

  assert(
    SafeMath256.add(aContractBalanceBefore, aFee) <= aContractBalanceAfter,
    'FLASH_ERROR: WRONG_RETURN_VALUE',
  );

  assert(
    SafeMath256.add(bContractBalanceBefore, bFee) <= bContractBalanceAfter,
    'FLASH_ERROR: WRONG_RETURN_VALUE',
  );

  // Get the new pool K value
  const newPoolK = SafeMath256.mul(
    normalizeToDecimals(
      aContractBalanceAfter,
      aDecimalsStored,
      normalizationDecimals,
    ),
    normalizeToDecimals(
      bContractBalanceAfter,
      bDecimalsStored,
      normalizationDecimals,
    ),
  );
  // Ensure that the new pool K value is greater than or equal to the old pool K value
  assert(newPoolK >= poolK, 'FLASH_ERROR: INVALID_POOL_K_VALUE');

  // Get flash loan fee receiver
  const flashLoanFeeReceiver = _getFlashLoanFeeReceiver();

  // Sent fees to flash loan fee receiver
  aToken.transfer(
    flashLoanFeeReceiver,
    aFee,
    getBalanceEntryCost(
      aTokenAddressStored,
      _getFlashLoanFeeReceiver().toString(),
    ),
  );
  
  bToken.transfer(
    flashLoanFeeReceiver,
    bFee,
    getBalanceEntryCost(
      bTokenAddressStored,
      _getFlashLoanFeeReceiver().toString(),
    ),
  );

  // Update the cumulative prices
  _updateCumulativePrices();

  // Transfer Remainning Coins
  transferRemaining(SCBalance, balance(), sent, Context.caller());

  // End reentrancy guard
  ReentrancyGuard.endNonReentrant();

  // Emit the event for the flash loan
  generateEvent(
    createEvent('FLASH_LOAN', [
      contractAddress.toString(), // Smart contract address
      Context.caller().toString(), // Caller address of the flash loan
      profitAddress, // Address of the user or smart contract that will receive the profit
      aAmount.toString(), // Amount of token A borrrowed
      bAmount.toString(), // Amount of token B borrrowed
      aContractBalanceAfter.toString(), // Amount of token A after the flash loan
      bContractBalanceAfter.toString(), //  Amount of token B after the flash loan
      poolFeeRate.toString(),
    ]),
  );
}

/**
 * Gets the current claimable protocol fee for token A in the basic pool.
 * @returns The claimable protocol fee for token A as a static array of 8-bit unsigned integers.
 */
export function getAClaimableProtocolFee(): StaticArray<u8> {
  return Storage.get(aProtocolFee);
}

/**
 * Gets the current claimable protocol fee for token B in the basic pool.
 * @returns The claimable protocol fee for token B as a static array of 8-bit unsigned integers.
 */
export function getBClaimableProtocolFee(): StaticArray<u8> {
  return Storage.get(bProtocolFee);
}

/**
 * Gets the address of token A used in the basic pool.
 * @returns The address of token A as a static array of 8-bit unsigned integers.
 */
export function getATokenAddress(): StaticArray<u8> {
  return Storage.get(aTokenAddress);
}

/**
 * Gets the address of token B used in the basic pool.
 * @returns The address of token B as a static array of 8-bit unsigned integers.
 */
export function getBTokenAddress(): StaticArray<u8> {
  return Storage.get(bTokenAddress);
}

/**
 * Gets the current fee rate of the basic pool.
 * @returns The fee rate as a static array of 8-bit unsigned integers.
 */
export function getFeeRate(): StaticArray<u8> {
  return Storage.get(feeRate);
}

/**
 * Gets the current flash loan fee of the basic pool.
 * @returns The flash loan fee as a static array of 8-bit unsigned integers.
 */
export function getFlashLoanFee(): StaticArray<u8> {
  return Storage.get(flashLoanFee);
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
 * Retrieves the total supply of liquidity pool token as a byte array.
 *
 * @returns {StaticArray<u8>} The total supply of liquidity pool token
 * converted to a byte array using the u256ToBytes function.
 */
export function getLPTotalSupply(): StaticArray<u8> {
  return u256ToBytes(liquidityManager.getTotalSupply());
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
 * Retrieves the timestamp of the last recorded timestamp from storage.
 *
 * @returns The timestamp of the last recorded timestamp as a byte array.
 */
export function getLastTimestamp(): StaticArray<u8> {
  return Storage.get(lastTimestamp);
}

/**
 *  Retrieves the swap estimation for a given input amount.
 *  @param binaryArgs - A serialized array of bytes containing the arguments for the function.
 *  - `tokenInAddress`: The address of the token to swap in.
 *  - `amountIn`: The amount of the token to swap in.
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

  const swapOutData = _getSwapOut(amountIn, tokenInAddress);

  return u256ToBytes(swapOutData.amountOut);
}

// INTERNAL FUNCTIONS

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
  callerAddress: Address = Context.caller(),
): addLiquidityData {
  const liquidityData = _getAddLiquidityData(
    amountA,
    amountB,
    minAmountA,
    minAmountB,
  );

  const liquidity = liquidityData.liquidity;
  const finalAmountA = liquidityData.finalAmountA;
  const finalAmountB = liquidityData.finalAmountB;
  const reserveA = liquidityData.reserveA;
  const reserveB = liquidityData.reserveB;
  const aTokenAddressStored = liquidityData.aTokenAddressStored;
  const bTokenAddressStored = liquidityData.bTokenAddressStored;
  const isInitialLiquidity = liquidityData.isInitialLiquidity;
  const initialLiquidityLock = liquidityData.initialLiquidityLock;

  assert(liquidity > u256.Zero, 'INSUFFICIENT LIQUIDITY MINTED');

  // Address of the current contract
  const contractAddress = Context.callee();

  // check if it is called by the registry
  if (!isCalledByRegistry) {
    // When the registry contract creates a new pool and adds liquidity to it at the same time,
    // it calls this `addLiquidityFromRegistry` function. In this case, we don't need to transfer tokens from the user to the contract because the amounts of tokens A and B are already transferred by the registry contract. We just need to set the local reserves of the pool and mint the corresponding amount of LP tokens to the user.

    // Transfer tokens A from user to contract
    new IMRC20(new Address(aTokenAddressStored)).transferFrom(
      callerAddress,
      contractAddress,
      finalAmountA,
      getBalanceEntryCost(aTokenAddressStored, callerAddress.toString()),
    );

    if (!isWithMAS) {
      // Transfer tokens B from user to contract if this function is not called from addLiquidityWithMAS
      new IMRC20(new Address(bTokenAddressStored)).transferFrom(
        callerAddress,
        contractAddress,
        finalAmountB,
        getBalanceEntryCost(bTokenAddressStored, callerAddress.toString()),
      );
    }
  }

  // Permanently lock the first initial liquidity lock
  if (isInitialLiquidity) {
    // Mint The initial liquidity lock LP tokens to empty address
    liquidityManager.mint(new Address(''), initialLiquidityLock);
  }

  // Mint LP tokens to user
  liquidityManager.mint(callerAddress, liquidity);

  // calculates the new reserves
  const newResA = SafeMath256.add(reserveA, finalAmountA);
  const newResB = SafeMath256.add(reserveB, finalAmountB);

  // Update reserves
  _updateReserveA(newResA);
  _updateReserveB(newResB);

  return new addLiquidityData(
    contractAddress.toString(),
    callerAddress.toString(),
    finalAmountA,
    finalAmountB,
    liquidity,
    newResA,
    newResB,
  );
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
 * Wraps a specified amount of MAS coins into WMAS tokens.
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

/**
 * Unwraps a specified amount of WMAS tokens into MAS coins.
 *
 * This function first checks if the contract has a sufficient balance of WMAS tokens
 * to unwrap the specified amount. It then retrieves the registry contract address and
 * the WMAS token address from storage, creates an instance of the WMAS contract, and
 * withdraws the specified amount of WMAS tokens to the provided address.
 *
 * @param amount - The amount of WMAS tokens to be unwrapped into MAS coins.
 * @param to - The address to receive the unwrapped MAS coins.
 * @throws Will throw an error if the contract does not have a sufficient balance of WMAS tokens.
 */
function _unwrapWMASToMas(amount: u256, to: Address): void {
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

  // check if the amount is less than or equal the contract balance
  const contractBalance = wmasToken.balanceOf(Context.callee());

  assert(amount <= contractBalance, 'INSUFFICIENT WMAS BALANCE IN CONTRACT');

  // Unwrap WMAS into MAS
  wmasToken.withdraw(amount.toU64(), to);

  // Generate an event to indicate that WMAS has been unwrapped into MAS
  generateEvent(
    `UNWRAP_WMAS: ${amount.toString()} of WMAS unwrapped into MAS to ${to.toString()}`,
  );
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

    generateEvent(
      createEvent('UPDATE_CUMULATIVE_PRICES:', [
        Context.callee().toString(), // Smart contract address
        Context.caller().toString(), // Caller address
        newCumulativeA.toString(), // aPriceCumulative
        newCumulativeB.toString(), // bPriceCumulative
        currentTimestamp.toString(), // lastTimestamp
      ]),
    );
  }
}

// INTERNAL GETTERS

/**
 * Calculates the output amount of tokens to be swapped in a liquidity pool,
 * considering the input amount, token addresses, and applicable fees.
 *
 * @param amountIn - The amount of input tokens to be swapped.
 * @param tokenInAddress - The address of the input token.
 * @returns An instance of GetSwapOutResult containing the calculated output amount,
 *          the address of the output token, reserves of both tokens, total fee,
 *          liquidity provider fee, protocol fee, and the input amount after fees.
 * @throws Will throw an error if the input token address is not part of the pool.
 */
function _getSwapOut(amountIn: u256, tokenInAddress: string): GetSwapOutResult {
  const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
  const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

  // Check if the token address is one of the two tokens in the pool
  assert(
    tokenInAddress == aTokenAddressStored ||
      tokenInAddress == bTokenAddressStored,
    'Invalid token address',
  );

  // Calculate fees
  const feeRate = _getFeeRate(); // e.g., 3000 ===> 0.3%
  const feeShareProtocol = _getFeeShareProtocol(); // e.g., 500 ====> 0.05

  // totalFee = amountIn * feeRate
  const totalFee = getFeeFromAmount(amountIn, feeRate);

  // protocolFee = totalFee * feeShareProtocol
  const protocolFee = getFeeFromAmount(totalFee, feeShareProtocol);

  // lpFee = totalFee - protocolFee
  const lpFee = SafeMath256.sub(totalFee, protocolFee);

  // amountInAfterFee = amountIn - totalFee
  const amountInAfterFee = SafeMath256.sub(amountIn, totalFee);

  // Get the decimals of the two tokens in the pool
  const aDecimalsStored = bytesToU32(Storage.get(aTokenDecimals));
  const bDecimalsStored = bytesToU32(Storage.get(bTokenDecimals));

  // Get the address of the other token in the pool and decimals of in and out
  let tokenOutAddress: string;
  let inDecimals: u32;
  let outDecimals: u32;

  if (tokenInAddress == aTokenAddressStored) {
    tokenOutAddress = bTokenAddressStored;
    inDecimals = aDecimalsStored;
    outDecimals = bDecimalsStored;
  } else {
    tokenOutAddress = aTokenAddressStored;
    inDecimals = bDecimalsStored;
    outDecimals = aDecimalsStored;
  }

  // Get the reserves of the two tokens in the pool
  const reserveIn = _getReserve(tokenInAddress);
  const reserveOut = _getReserve(tokenOutAddress);

  // Normalize amountInAfterFee, reserveIn, and reserveOut to 18 decimals
  const normAmountInAfterFee = normalizeToDecimals(
    amountInAfterFee,
    inDecimals,
    normalizationDecimals,
  );
  const normReserveIn = normalizeToDecimals(
    reserveIn,
    inDecimals,
    normalizationDecimals,
  );
  const normReserveOut = normalizeToDecimals(
    reserveOut,
    outDecimals,
    normalizationDecimals,
  );

  // Calculate the amount of tokens to be swapped
  const normAmountOut = getAmountOut(
    normAmountInAfterFee,
    normReserveIn,
    normReserveOut,
  );

  const amountOut = denormalizeFromDecimals(
    normAmountOut,
    outDecimals,
    normalizationDecimals,
  );

  return new GetSwapOutResult(
    amountOut,
    tokenOutAddress,
    reserveIn,
    reserveOut,
    totalFee,
    lpFee,
    protocolFee,
    amountInAfterFee,
    normAmountInAfterFee,
    normReserveIn,
    normReserveOut,
    normAmountOut,
    inDecimals,
    outDecimals,
  );
}

/**
 * Calculates the liquidity data for adding liquidity to a pool.
 *
 * @param amountA - The amount of token A to add.
 * @param amountB - The amount of token B to add.
 * @param minAmountA - The minimum acceptable amount of token A.
 * @param minAmountB - The minimum acceptable amount of token B.
 * @returns An instance of GetLiquidityDataResult containing the calculated liquidity,
 *          final amounts of tokens A and B, and the reserves of tokens A and B.
 * @throws Will throw an error if amountA or amountB is zero, or if the final amounts
 *         are less than the specified minimum amounts.
 */
function _getAddLiquidityData(
  amountA: u256,
  amountB: u256,
  minAmountA: u256,
  minAmountB: u256,
): GetLiquidityDataResult {
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
  let isInitialLiquidity = false;
  let initialLiquidityLock: u256 = u256.Zero;

  let aDecimalsStored = bytesToU32(Storage.get(aTokenDecimals));
  let bDecimalsStored = bytesToU32(Storage.get(bTokenDecimals));

  // Normalize the amounts to default decimals (18)
  const normAmountA = normalizeToDecimals(
    amountA,
    aDecimalsStored,
    normalizationDecimals,
  );
  const normAmountB = normalizeToDecimals(
    amountB,
    bDecimalsStored,
    normalizationDecimals,
  );

  // Also normalize reserves for proper proportional math.
  const normReserveA = normalizeToDecimals(
    reserveA,
    aDecimalsStored,
    normalizationDecimals,
  );
  const normReserveB = normalizeToDecimals(
    reserveB,
    bDecimalsStored,
    normalizationDecimals,
  );

  let normFinalAmountA = normAmountA;
  let normFinalAmountB = normAmountB;

  if (reserveA == u256.Zero && reserveB == u256.Zero) {
    // Use normalized values to calculate liquidity:
    // Initial liquidity: liquidity = sqrt(amountA * amountB)
    const product = SafeMath256.mul(normAmountA, normAmountB);
    // totalLiquidity = sqrt(product)
    const totalLiquidity = SafeMath256.sqrt(product);

    // Calculate the total liquidity with safety factor (totalLiquidity * safetyFactor)
    const totalLpSafety = SafeMath256.mul(totalLiquidity, safetyFactor);

    // Get the division of totalLpSafety by amountA and amountB ( totalLpSafety / amountA and totalLpSafety / amountB )
    const LpDivA = SafeMath256.div(totalLpSafety, amountA);
    const LpDivB = SafeMath256.div(totalLpSafety, amountB);

    // Get the maximum value between LpDivA and LpDivB
    const maxLpDiv = LpDivA > LpDivB ? LpDivA : LpDivB;

    // Calculate the initial liquidity lock which is the maximum value between LpDivA and LpDivB
    initialLiquidityLock = maxLpDiv;

    // Ensure that the totalLiquidity is greater than the initial liquidity lock
    assert(totalLiquidity > initialLiquidityLock, 'TOO_SMALL_LIQUIDITY');

    // liquidity = totalLiquidity - INITIAL_LIQUIDITY_LOCK
    liquidity = SafeMath256.sub(totalLiquidity, initialLiquidityLock);

    isInitialLiquidity = true;
  } else {
    // Adding liquidity proportional to the current pool
    // Calculate the optimal normalized amount of token B based on provided token A.
    // amountBOptimal = (amountA * reserveB) / reserveA
    const amountBOptimal = SafeMath256.div(
      SafeMath256.mul(normAmountA, normReserveB),
      normReserveA,
    );

    if (amountBOptimal > normAmountB) {
      // User provided less token B than optimal.
      // Recalculate optimal normalized amount of token A given token B.
      // amountAOptimal = (amountB * reserveA) / reserveB
      const amountAOptimal = SafeMath256.div(
        SafeMath256.mul(normAmountB, normReserveA),
        normReserveB,
      );
      normFinalAmountA = amountAOptimal;
      // Convert the optimal normalized token A amount back to its raw value.
      finalAmountA = denormalizeFromDecimals(
        amountAOptimal,
        aDecimalsStored,
        normalizationDecimals,
      );
    } else {
      // User provided more B than needed, adjust B
      normFinalAmountB = amountBOptimal;
      finalAmountB = denormalizeFromDecimals(
        amountBOptimal,
        bDecimalsStored,
        normalizationDecimals,
      );
    }

    // assert that the finalAmountA and finalAmountB are greater than minAmountA and minAmountB
    assert(finalAmountA >= minAmountA, 'LESS_MIN_A_AMOUNT');
    assert(finalAmountB >= minAmountB, 'LESS_MIN_B_AMOUNT');

    // liquidity = min((finalAmountA * totalSupply / reserveA), (finalAmountB * totalSupply / reserveB))
    const liqA = SafeMath256.div(
      SafeMath256.mul(normFinalAmountA, totalSupply),
      normReserveA,
    );

    const liqB = SafeMath256.div(
      SafeMath256.mul(normFinalAmountB, totalSupply),
      normReserveB,
    );

    liquidity = liqA < liqB ? liqA : liqB;
  }

  return new GetLiquidityDataResult(
    liquidity,
    finalAmountA,
    finalAmountB,
    reserveA,
    reserveB,
    aTokenAddressStored,
    bTokenAddressStored,
    initialLiquidityLock,
    isInitialLiquidity,
  );
}

/**
 * Retrieves the current fee rate for the protocol.
 *
 * @returns The current fee rate for the protocol.
 */
function _getFeeRate(): u64 {
  return bytesToU64(Storage.get(feeRate));
}

/**
 * Retrieves the current fee share for the protocol.
 *
 * @returns The current fee share for the protocol.
 */
function _getFeeShareProtocol(): u64 {
  return bytesToU64(Storage.get(feeShareProtocol));
}

/**
 * Retrieves the current flash loan fee for the protocol.
 *
 * @returns The current flash loan fee for the protocol.
 */
function _getFlashLoanFee(): u64 {
  return bytesToU64(Storage.get(flashLoanFee));
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
 * Retrieves the flash loan fee receiver from the registry contract.
 * @param registryAddress The address of the registry contract.
 * @returns The flash loan fee receiver address.
 */
function _getFlashLoanFeeReceiver(
  registryAddress: string = bytesToString(Storage.get(registryContractAddress)),
): Address {
  return new Address(
    new IRegistery(new Address(registryAddress)).getFlashLoanFeeReceiver(),
  );
}

/**
 * Checks if the caller is the owner of the registry contract.
 * @param registryAddress The address of the registry contract.
 * @returns void
 */
export function _onlyRegistryOwner(
  registryAddress: string = bytesToString(Storage.get(registryContractAddress)),
): void {
  const registry = new IRegistery(new Address(registryAddress));

  assert(
    Context.caller().toString() == registry.ownerAddress(),
    'CALLER_IS_NOT_REGISTRY_OWNER',
  );
}
