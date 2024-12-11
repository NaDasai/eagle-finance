// The entry file of your WebAssembly module.
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
  bytesToString,
  bytesToU16,
  stringToBytes,
  u16ToBytes,
  u256ToBytes,
} from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';
import { PersistentMap } from '../lib/PersistentMap';
import { IMRC20 } from '../interfaces/IMRC20';
import { setOwner } from '../utils/ownership';
import { _onlyOwner, _setOwner } from '../utils/ownership-internal';
import { getTokenBalance } from '../utils/token';
import { getAmountOut, getInputAmountNet } from '../lib/poolMath';
import { powerU256 } from '../lib/math';

export const reserves = new PersistentMap<Address, u256>('reserves');
export const protocolFees = new PersistentMap<Address, u256>('protocolFees');

export const lpManagerKey = stringToBytes('lpManager');
export const tokenAAddressKey = stringToBytes('tokenA');
export const tokenBAddressKey = stringToBytes('tokenB');
export const feeRateKey = stringToBytes('feeRate');
export const feeShareProtocolKey = stringToBytes('feeShareProtocol');
export const lpManagerAddressKey = stringToBytes('lpManager');

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

  const addressA = args.nextString().expect('Address A is missing or invalid');
  const addressB = args.nextString().expect('Address B is missing or invalid');
  const inputFeeRate = args
    .nextU16()
    .expect('Input fee rate is missing or invalid');
  const FeeShareProtocol = args
    .nextU16()
    .expect('Fee share protocol is missing or invalid');

  const lpManagerTokenAddress = args
    .nextString()
    .expect('LpManagerTTokenAddress is missing or invalid');

  // store fee rate
  Storage.set(feeRateKey, u16ToBytes(inputFeeRate));
  // store fee share protocol
  Storage.set(feeShareProtocolKey, u16ToBytes(FeeShareProtocol));
  // store the lpManager token address
  Storage.set(lpManagerAddressKey, stringToBytes(lpManagerTokenAddress));

  // store the tokens a and b addresses
  Storage.set(tokenAAddressKey, stringToBytes(addressA));
  Storage.set(tokenBAddressKey, stringToBytes(addressB));

  // store the tokens a and b addresses reserves in the contract storage
  reserves.set(new Address(addressA), u256.Zero);
  reserves.set(new Address(addressB), u256.Zero);

  // set the owner of the contract
  _setOwner(Context.caller().toString());

  generateEvent(`Constructor called`);
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

  const tokenAAddress = bytesToString(Storage.get(tokenAAddressKey));
  const tokenBAddress = bytesToString(Storage.get(tokenBAddressKey));
  const lpManagerTokenAddress = bytesToString(Storage.get(lpManagerAddressKey));

  const reserveA = _getLocalReserveA();
  const reserveB = _getLocalReserveB();

  const lpToken = new IMRC20(new Address(lpManagerTokenAddress));
  const totalSupply = lpToken.totalSupply();

  let finalAmountA = amountA;
  let finalAmountB = amountB;
  let liquidity: u256;

  if (reserveA == u256.Zero && reserveB == u256.Zero) {
    // Initial liquidity: liquidity = sqrt(amountA * amountB)
    const product = u256.mul(amountA, amountB);
    // TOTEST: sqrt is not implemented in u256 type so we use manual powerU256 instead
    liquidity = powerU256(product, i64.parse(f64(0.5).toString()));
  } else {
    // Add liquidity proportionally
    // Optimal amountB given amountA:
    const amountBOptimal = u256.div(u256.mul(amountA, reserveB), reserveA);
    if (amountBOptimal > amountB) {
      // User provided less B than optimal, adjust A
      const amountAOptimal = u256.div(u256.mul(amountB, reserveA), reserveB);
      finalAmountA = amountAOptimal;
    } else {
      // User provided more B than needed, adjust B
      finalAmountB = amountBOptimal;
    }

    // liquidity = min((finalAmountA * totalSupply / reserveA), (finalAmountB * totalSupply / reserveB))
    const liqA = u256.div(u256.mul(finalAmountA, totalSupply), reserveA);
    const liqB = u256.div(u256.mul(finalAmountB, totalSupply), reserveB);
    liquidity = liqA < liqB ? liqA : liqB;

    assert(liquidity > u256.Zero, 'Insufficient liquidity minted');

    const contractAddress = Context.callee();

    // Transfer tokens from user to contract
    new IMRC20(new Address(tokenAAddress)).transfer(
      contractAddress,
      finalAmountA,
    );

    new IMRC20(new Address(tokenBAddress)).transfer(
      contractAddress,
      finalAmountB,
    );

    // Mint LP tokens to user
    lpToken.mint(Context.caller(), liquidity);

    // Update reserves
    _updateReserveA(u256.add(reserveA, finalAmountA));
    _updateReserveB(u256.add(reserveB, finalAmountB));

    generateEvent(
      `Liquidity added: ${finalAmountA.toString()} of A and ${finalAmountB.toString()} of B, minted ${liquidity.toString()} LP`,
    );
  }
}

/**
 *  Swaps tokens in the pool.
 * @param binaryArgs - Arguments serialized with Args (tokenInAddress, amountIn)
 * @returns void
 */
export function swap(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const tokenInAddress = args
    .nextString()
    .expect('TokenIn is missing or invalid');

  const amountIn = args.nextU256().expect('AmountIn is missing or invalid');

  const tokenAAddress = bytesToString(Storage.get(tokenAAddressKey));
  const tokenBAddress = bytesToString(Storage.get(tokenBAddressKey));

  // check if the token address is one of the two tokens in the pool
  assert(
    tokenInAddress == tokenAAddress || tokenInAddress == tokenBAddress,
    'Invalid token address',
  );

  // Calculate fees
  const feeRate = _getFeeRate(); // e.g., 3 => 3%
  const feeShareProtocol = _getFeeShareProtocol(); // e.g., 50 => 50%

  // totalFee = (amountIn * feeRate) / 100
  const totalFee = getInputAmountNet(amountIn, feeRate);

  // protocolFee = (totalFee * feeShareProtocol) / 100
  const protocolFee = getInputAmountNet(totalFee, feeShareProtocol);

  // lpFee = totalFee - protocolFee
  const lpFee = u256.sub(totalFee, protocolFee);

  // netInput = amountIn - totalFee
  const netInput = u256.sub(amountIn, totalFee);

  // get the address of the other token in the pool
  const tokenOutAddress =
    tokenInAddress == tokenAAddress ? tokenBAddress : tokenAAddress;

  // get the reserves of the two tokens in the pool
  const reserveIn = reserves.get(new Address(tokenInAddress), u256.Zero);
  const reserveOut = reserves.get(new Address(tokenOutAddress), u256.Zero);

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
  const newReserveIn = u256.add(reserveIn, u256.add(netInput, lpFee));
  const newReserveOut = u256.sub(reserveOut, amountOut);

  reserves.set(new Address(tokenInAddress), newReserveIn);
  reserves.set(new Address(tokenOutAddress), newReserveOut);

  // Accumulate protocol fees
  if (protocolFee > u256.Zero) {
    _addProtocolFee(tokenInAddress, protocolFee);
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
export function claimProtocolFees(tokenAddress: string): void {
  _onlyOwner();

  const accumulatedFees = protocolFees.get(
    new Address(tokenAddress),
    u256.Zero,
  );
  assert(accumulatedFees > u256.Zero, 'No accumulated fees');

  // Transfer accumulated protocol fees to the owner
  new IMRC20(new Address(tokenAddress)).transferFrom(
    Context.callee(),
    Context.caller(), // the owner
    accumulatedFees,
  );

  // Reset protocol fees for that token
  protocolFees.set(new Address(tokenAddress), u256.Zero);

  generateEvent(
    `Protocol fees claimed: ${accumulatedFees.toString()} of ${tokenAddress}`,
  );
}

/**
 *  Removes liquidity from the pool.
 *  @param binaryArgs - Arguments serialized with Args (lpTokenAmount)
 * @returns void
 */
export function removeLiquidity(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const lpTokenAmount = args
    .nextU256()
    .expect('LpTokenAmount is missing or invalid');

  const tokenAAddress = bytesToString(Storage.get(tokenAAddressKey));
  const tokenBAddress = bytesToString(Storage.get(tokenBAddressKey));
  const lpManagerTokenAddress = bytesToString(Storage.get(lpManagerAddressKey));

  const lpToken = new IMRC20(new Address(lpManagerTokenAddress));
  const totalSupply = lpToken.totalSupply();

  // Current reserves
  const reserveA = _getLocalReserveA();
  const reserveB = _getLocalReserveB();

  // amountAOut = (lpTokenAmount * reserveA) / totalSupply
  const amountAOut = u256.div(u256.mul(lpTokenAmount, reserveA), totalSupply);
  // amountBOut = (lpTokenAmount * reserveB) / totalSupply
  const amountBOut = u256.div(u256.mul(lpTokenAmount, reserveB), totalSupply);

  // burn lp tokens
  lpToken.burn(lpTokenAmount);

  // Transfer tokens to user
  new IMRC20(new Address(tokenAAddress)).transferFrom(
    Context.callee(),
    Context.caller(),
    amountAOut,
  );
  new IMRC20(new Address(tokenBAddress)).transferFrom(
    Context.callee(),
    Context.caller(),
    amountBOut,
  );

  // Update reserves
  _updateReserveA(u256.sub(reserveA, amountAOut));
  _updateReserveB(u256.sub(reserveB, amountBOut));

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

  const tokenAAddress = bytesToString(Storage.get(tokenAAddressKey));
  const tokenBAddress = bytesToString(Storage.get(tokenBAddressKey));

  // Validate tokenIn is either tokenA or tokenB
  assert(
    tokenInAddress == tokenAAddress || tokenInAddress == tokenBAddress,
    'Invalid token address for input',
  );

  const tokenOutAddress =
    tokenInAddress == tokenAAddress ? tokenBAddress : tokenAAddress;

  // Get current reserves
  const reserveIn = reserves.get(new Address(tokenInAddress), u256.Zero);
  const reserveOut = reserves.get(new Address(tokenOutAddress), u256.Zero);

  // Calculate amountOut
  const amountOut = getAmountOut(amountIn, reserveIn, reserveOut);

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
  // called only by the owner of the pool
  _onlyOwner();

  // const reserveA = _getLocalReserveA();
  // const reserveB = _getLocalReserveB();

  // get teh balance of this contract for token A
  const balanceA = getTokenBalance(
    new Address(bytesToString(Storage.get(tokenAAddressKey))),
  );

  // get teh balance of this contract for token B
  const balanceB = getTokenBalance(
    new Address(bytesToString(Storage.get(tokenBAddressKey))),
  );

  // update reserves
  _updateReserveA(balanceA);
  _updateReserveB(balanceB);
}

/**
 * Retrieves the local reserve of token A.
 *
 * @returns The current reserve of token A in the pool.
 */
function _getLocalReserveA(): u256 {
  return reserves.get(
    new Address(bytesToString(Storage.get(tokenAAddressKey))),
    u256.Zero,
  );
}

/**
 * Retrieves the local reserve of token B.
 *
 * @returns The current reserve of token B in the pool.
 */
function _getLocalReserveB(): u256 {
  return reserves.get(
    new Address(bytesToString(Storage.get(tokenBAddressKey))),
    u256.Zero,
  );
}

function _getFeeRate(): u16 {
  return bytesToU16(Storage.get(feeRateKey));
}

function _getFeeShareProtocol(): u16 {
  return bytesToU16(Storage.get(feeShareProtocolKey));
}

function _addProtocolFee(tokenAddress: string, amount: u256): void {
  const current = protocolFees.get(new Address(tokenAddress), u256.Zero);
  protocolFees.set(new Address(tokenAddress), u256.add(current, amount));
}

/**
 *  Updates the reserve of token A in the pool.
 *  @param amount - The new amount of token A in the pool.
 */
function _updateReserveA(amount: u256): void {
  reserves.set(
    new Address(bytesToString(Storage.get(tokenAAddressKey))),
    amount,
  );
}

/**
 *  Updates the reserve of token B in the pool.
 * @param amount - The new amount of token B in the pool.
 */
function _updateReserveB(amount: u256): void {
  reserves.set(
    new Address(bytesToString(Storage.get(tokenBAddressKey))),
    amount,
  );
}
