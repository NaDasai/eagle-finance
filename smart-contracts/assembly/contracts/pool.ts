import {
  Context,
  generateEvent,
  Storage,
  Address,
  assertIsSmartContract,
  print,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  bytesToF64,
  bytesToString,
  bytesToU256,
  f64ToBytes,
  stringToBytes,
  u256ToBytes,
  u64ToBytes,
} from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';
import { IMRC20 } from '../interfaces/IMRC20';
import { _onlyOwner, _setOwner } from '../utils/ownership-internal';
import { getTokenBalance } from '../utils/token';
import { getAmountOut, getFeeFromAmount } from '../lib/poolMath';
import { isBetweenZeroAndOne } from '../lib/math';
import { IRegistery } from '../interfaces/IRegistry';
import { _ownerAddress } from '../utils/ownership';
import { SafeMath256 } from '../lib/safeMath';
import {
  LiquidityManager,
  StoragePrefixManager,
} from '../lib/liquidityManager';

// storage key containning the value of the token A reserve inside the pool
export const aTokenReserve = stringToBytes('aTokenReserve');
// storage key containning the value of the token B reserve inside the pool
export const bTokenReserve = stringToBytes('bTokenReserve');
// storage key containning address of the token A inside the pool
export const aTokenAddress = stringToBytes('tokenA');
// storage key containning address of the token B inside the pool
export const bTokenAddress = stringToBytes('tokenB');
// storage key containning the accumulated fee protocol of the token A inside the pool
export const aProtocolFee = stringToBytes('aProtocolFee');
// storage key containning the accumulated fee protocol of the token B inside the pool
export const bProtocolFee = stringToBytes('bProtocolFee');
// storage key containning the fee rate value of the pool. value is between 0 and 1
export const feeRate = stringToBytes('feeRate');
// storage key containning the address of the registry contract inside the pool
export const registryContractAddress = stringToBytes('registry');
// create new liquidity manager
const storagePrefixManager = new StoragePrefixManager();
const liquidityManager = new LiquidityManager<u256>(storagePrefixManager);

/**
 * This function is meant to be called only one time: when the contract is deployed.
 * @param binaryArgs - Arguments serialized with Args (aAddress, bAddress, feeRate, feeShareProtocol, lpTokenAddress, registryAddress)
 */
export function constructor(binaryArgs: StaticArray<u8>): void {
  // This line is important. It ensures that this function can't be called in the future.
  // If you remove this check, someone could call your constructor function and reset your smart contract.
  assert(Context.isDeployingContract());

  const args = new Args(binaryArgs);

  // read the arguments
  const aAddress = args.nextString().expect('Address A is missing or invalid');
  const bAddress = args.nextString().expect('Address B is missing or invalid');

  const inputFeeRate = args
    .nextF64()
    .expect('Input fee rate is missing or invalid');

  const registryAddress = args
    .nextString()
    .expect('RegistryAddress is missing or invalid');

  // esnure that the fee rate is between 0 and 1
  assert(isBetweenZeroAndOne(inputFeeRate), 'Fee rate must be between 0 and 1');

  /* 
        To return after tests 
  // ensure that the aAddress is a valid smart contract address
  assertIsSmartContract(aAddress);

  // ensure that the bAddress is a valid smart contract address
  assertIsSmartContract(bAddress);

  // ensure that the registryAddress is a valid smart contract address
  assertIsSmartContract(registryAddress); */

  // store fee rate
  Storage.set(feeRate, f64ToBytes(inputFeeRate));

  // store the tokens a and b addresses
  Storage.set(aTokenAddress, stringToBytes(aAddress));
  Storage.set(bTokenAddress, stringToBytes(bAddress));

  // store the tokens a and b addresses reserves in the contract storage
  Storage.set(aTokenReserve, u256ToBytes(u256.Zero));
  Storage.set(bTokenReserve, u256ToBytes(u256.Zero));

  // store the registry address
  Storage.set(registryContractAddress, stringToBytes(registryAddress));

  // get the registry contract instance
  const registry = new IRegistery(new Address(registryAddress));

  // set the owner of the pool contract to the same registry owner address
  _setOwner(registry.ownerAddress());

  generateEvent(
    `New pool deployed at ${Context.callee()}. Token A: ${aAddress}. Token B: ${bAddress}. Registry: ${registryAddress}.`,
  );
}

/**
 *  Adds liquidity to the pool.
 *  @param binaryArgs - Arguments serialized with Args (amountA, amountB)
 * @returns void
 */
export function addLiquidity(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const amountA = args.nextU256().expect('Amount A is missing or invalid');
  const amountB = args.nextU256().expect('Amount B is missing or invalid');

  // retrieve the token addresses from storage
  const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
  const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

  // get the reserves of the two tokens in the pool
  const reserveA = _getLocalReserveA();
  const reserveB = _getLocalReserveB();

  // get the total supply of the LP token
  const totalSupply: u256 = liquidityManager.getTotalSupply();

  let finalAmountA = amountA;
  let finalAmountB = amountB;
  let liquidity: u256;

  if (reserveA == u256.Zero && reserveB == u256.Zero) {
    // Initial liquidity: liquidity = sqrt(amountA * amountB)
    const product = SafeMath256.mul(amountA, amountB);
    // TOTEST: sqrt is not implemented in u256 type so we use manual powerU256 instead
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

  assert(liquidity > u256.Zero, 'Insufficient liquidity minted');

  // address of the current contract
  const contractAddress = Context.callee();

  // Transfer tokens A from user to contract
  new IMRC20(new Address(aTokenAddressStored)).transfer(
    contractAddress,
    finalAmountA,
  );

  // Transfer tokens B from user to contract
  new IMRC20(new Address(bTokenAddressStored)).transfer(
    contractAddress,
    finalAmountB,
  );

  // Mint LP tokens to user
  liquidityManager.mint(Context.caller(), liquidity);

  // Update reserves
  _updateReserveA(SafeMath256.add(reserveA, finalAmountA));
  _updateReserveB(SafeMath256.add(reserveB, finalAmountB));

  generateEvent(
    `Liquidity added: ${finalAmountA.toString()} of A and ${finalAmountB.toString()} of B, minted ${liquidity.toString()} LP`,
  );
}

/**
 *  Swaps tokens in the pool.
 * @param binaryArgs - Arguments serialized with Args (tokenInAddress, amountIn)
 * @returns void
 */
export function swap(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  // get the tokenIn address
  const tokenInAddress = args
    .nextString()
    .expect('TokenIn is missing or invalid');

  // get the amount of tokenIn to swap
  const amountIn = args.nextU256().expect('AmountIn is missing or invalid');

  const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
  const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

  // check if the token address is one of the two tokens in the pool
  assert(
    tokenInAddress == aTokenAddressStored ||
      tokenInAddress == bTokenAddressStored,
    'Invalid token address',
  );

  // Calculate fees
  const feeRate = _getFeeRate(); // e.g., 0.003
  const feeShareProtocol = _getFeeShareProtocol(); // e.g., 0.05

  // totalFee = (amountIn * feeRate) / 100
  const totalFee = getFeeFromAmount(amountIn, feeRate);

  // protocolFee = (totalFee * feeShareProtocol) / 100
  const protocolFee = getFeeFromAmount(totalFee, feeShareProtocol);

  // lpFee = totalFee - protocolFee
  const lpFee = SafeMath256.sub(totalFee, protocolFee);

  // netInput = amountIn - totalFee
  const netInput = SafeMath256.sub(amountIn, totalFee);

  // get the address of the other token in the pool
  const tokenOutAddress =
    tokenInAddress == aTokenAddressStored
      ? bTokenAddressStored
      : aTokenAddressStored;

  // get the reserves of the two tokens in the pool
  const reserveIn = _getReserve(tokenInAddress);
  const reserveOut = _getReserve(tokenOutAddress);

  // calculate the amount of tokens to be swapped
  const amountOut = getAmountOut(netInput, reserveIn, reserveOut);

  // esnure that the amountOut is greater than zero
  assert(amountOut > u256.Zero, 'AmountOut is less than or equal to zero');

  // transfer the amountIn to the contract
  new IMRC20(new Address(tokenInAddress)).transfer(Context.callee(), amountIn);

  // transfer the amountOut to the caller
  new IMRC20(new Address(tokenOutAddress)).transferFrom(
    Context.callee(),
    Context.caller(),
    amountOut,
  );

  // Update reserves:
  // The input reserve increases by netInput + lpFee (the portion of fees that goes to the LPs).
  // The protocolFee is not added to reserves. Instead, we store it separately.
  const newReserveIn = SafeMath256.add(
    reserveIn,
    SafeMath256.add(netInput, lpFee),
  );
  const newReserveOut = SafeMath256.sub(reserveOut, amountOut);

  // update the pool reserves
  _updateReserve(tokenInAddress, newReserveIn);
  _updateReserve(tokenOutAddress, newReserveOut);

  // Accumulate protocol fees
  if (protocolFee > u256.Zero) {
    _addTokenAccumulatedProtocolFee(tokenInAddress, protocolFee);
  }

  generateEvent(
    `Swap: In=${amountIn.toString()} of ${tokenInAddress}, Out=${amountOut.toString()} of ${tokenOutAddress}, Fees: total=${totalFee.toString()}, protocol=${protocolFee.toString()}, lp=${lpFee.toString()}`,
  );
}

/**
 * Claims accumulated protocol fees for a given token.
 * @param tokenAddress - Address of the token to claim fees for.
 * @returns void
 */
export function claimProtocolFees(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  // get the token address from the arguments
  const tokenAddress = args.nextString().expect('No token address');

  // get the token addresses from storage
  const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
  const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

  // ensure tokenAddress is either tokenA or tokenB
  assert(
    tokenAddress == aTokenAddressStored || tokenAddress == bTokenAddressStored,
    'Invalid token address',
  );

  // get accumulated fees of the token
  const accumulatedFeesStored = _getTokenAccumulatedProtocolFee(tokenAddress);

  assert(accumulatedFeesStored > u256.Zero, 'No accumulated fees');

  // Transfer accumulated protocol fees to the owner
  new IMRC20(new Address(tokenAddress)).transferFrom(
    Context.callee(),
    _ownerAddress(), // the owner of the registry contract
    accumulatedFeesStored,
  );

  // Reset protocol fees for that token
  _setTokenAccumulatedProtocolFee(tokenAddress, u256.Zero);

  generateEvent(
    `Protocol fees claimed: ${accumulatedFeesStored.toString()} of ${tokenAddress} by ${Context.caller().toString()}`,
  );
}

/**
 *  Removes liquidity from the pool.
 *  @param binaryArgs - Arguments serialized with Args (lpTokenAmount)
 * @returns void
 */
export function removeLiquidity(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  // get the amount of LP tokens to remove from params
  const lpTokenAmount = args
    .nextU256()
    .expect('LpTokenAmount is missing or invalid');

  // ensure that the user has enough LP tokens
  assert(
    liquidityManager.getBalance(Context.caller()) >= lpTokenAmount,
    'Not enough LP tokens',
  );

  // get the token addresses from storage
  const aTokenAddressStored = bytesToString(Storage.get(aTokenAddress));
  const bTokenAddressStored = bytesToString(Storage.get(bTokenAddress));

  const totalSupply = liquidityManager.getTotalSupply();

  // Current reserves
  const reserveA = _getLocalReserveA();
  const reserveB = _getLocalReserveB();

  // amountAOut = (lpTokenAmount * reserveA) / totalSupply
  const amountAOut = SafeMath256.div(
    SafeMath256.mul(lpTokenAmount, reserveA),
    totalSupply,
  );
  // amountBOut = (lpTokenAmount * reserveB) / totalSupply
  const amountBOut = SafeMath256.div(
    SafeMath256.mul(lpTokenAmount, reserveB),
    totalSupply,
  );

  // burn lp tokens
  liquidityManager.burn(Context.caller(), lpTokenAmount);

  // Transfer tokens to user
  new IMRC20(new Address(aTokenAddressStored)).transferFrom(
    Context.callee(),
    Context.caller(),
    amountAOut,
  );
  new IMRC20(new Address(bTokenAddressStored)).transferFrom(
    Context.callee(),
    Context.caller(),
    amountBOut,
  );

  // Update reserves
  _updateReserveA(SafeMath256.sub(reserveA, amountAOut));
  _updateReserveB(SafeMath256.sub(reserveB, amountBOut));

  generateEvent(
    `Removed liquidity: ${lpTokenAmount.toString()} LP burned, ${amountAOut.toString()} A and ${amountBOut.toString()} B returned`,
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
  const amountIn = args.nextU256().expect('AmountIn is missing or invalid');

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
  const feeRate = _getFeeRate(); // e.g., 0.003
  const feeShareProtocol = _getFeeShareProtocol(); // e.g., 0.05

  // totalFee = (amountIn * feeRate) / 100
  const totalFee = getFeeFromAmount(amountIn, feeRate);

  // netInput = amountIn - totalFee
  const netInput = SafeMath256.sub(amountIn, totalFee);

  // Calculate amountOut
  const amountOut = getAmountOut(netInput, reserveIn, reserveOut);

  // For estimation, we simply emit an event or store in some state (here we choose event)
  generateEvent(
    `Estimation: Input = ${amountIn.toString()} of ${tokenInAddress}, Output = ${amountOut.toString()} of ${tokenOutAddress}`,
  );

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
 * Retrieves the price of Token A in terms of Token B.
 * @returns The price of token A in terms of token B, as a u256 represented as a fraction.
 * Returns zero if the b reserve is zero to avoid division by zero error.
 */
export function getPrice(): StaticArray<u8> {
  const reserveA = _getLocalReserveA();
  const reserveB = _getLocalReserveB();

  // If reserveB is zero return zero
  if (reserveB == u256.Zero) {
    return u256ToBytes(u256.Zero);
  }

  // priceAInB = reserveB / reserveA
  const price = SafeMath256.div(reserveB, reserveA);

  return u256ToBytes(price);
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
  const registryAddressStored = bytesToString(
    Storage.get(registryContractAddress),
  );
  const registery = new IRegistery(new Address(registryAddressStored));

  return registery.getFeeShareProtocol();
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
