import {
  Address,
  assertIsSmartContract,
  balance,
  Context,
  generateEvent,
  Storage,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  bytesToI32,
  bytesToString,
  i32ToBytes,
  stringToBytes,
  u256ToBytes,
} from '@massalabs/as-types';
import { SwapPath } from '../structs/swapPath';
import { IBasicPool } from '../interfaces/IBasicPool';
import {
  DEFAULT_ROUTE_LENGTH_LIMIT,
  NATIVE_MAS_COIN_ADDRESS,
} from '../utils/constants';
import { IMRC20 } from '../interfaces/IMRC20';
import { getBalanceEntryCost } from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20-external';
import { IRegistery } from '../interfaces/IRegistry';
import { u256 } from 'as-bignum/assembly';
import {
  _ensureDeadlineNotExpired,
  transferRemaining,
  wrapMasToWMAS,
} from '../utils';
import { ReentrancyGuard } from '../lib/ReentrancyGuard';

// Storage key containing the address of the registry contract inside the swap router contract
const registryContractAddress = stringToBytes('registry');
// Storage key containing the route limit value
const routeLimitKey = stringToBytes('routeLimit');

export function constructor(binaryArgs: StaticArray<u8>): void {
  // This line is important. It ensures that this function can't be called in the future.
  // If you remove this check, someone could call your constructor function and reset your smart contract.
  assert(Context.isDeployingContract());

  const args = new Args(binaryArgs);

  const registryAddress = args
    .nextString()
    .expect('RegistryAddress is missing or invalid');

  // ensure that the registryAddress is a valid smart contract address
  assertIsSmartContract(registryAddress);

  // Store the registry address
  Storage.set(registryContractAddress, stringToBytes(registryAddress));
  // Store the default route limit value
  Storage.set(routeLimitKey, i32ToBytes(DEFAULT_ROUTE_LENGTH_LIMIT));

  // Initialize the ReentrancyGuard
  ReentrancyGuard.__ReentrancyGuard_init();
}

/**
 * Swaps tokens using the provided swap path.
 * @param binaryArgs - Arguments serialized with Args (swapPathArray, coinsOnEachSwap)
 * - `swapPathArray`: An array of SwapPath objects representing the swap path.
 * - `coinsOnEachSwap`: The storage coins to use on each swap.
 * @returns StaticArray<u8> - The serialized result of the swap.
 */
export function swap(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  // Start the reentrancy guard
  ReentrancyGuard.nonReentrant();

  // Get the current balance of the smart contract
  const SCBalance = balance();
  // Get the coins transferred to the smart contract
  const sent = Context.transferredCoins();

  const args = new Args(binaryArgs);

  // Read the swap Path array args
  let swapPathArray = args
    .nextSerializableObjectArray<SwapPath>()
    .expect('Invalid swap path array');

  // Read coins to use on each swap
  const coinsOnEachSwap = args.nextU64().expect('Invalid coins');

  const deadline = args.nextU64().expect('Invalid deadline');

  // Get the route limit stored
  const routeLimitStored = bytesToI32(Storage.get(routeLimitKey));

  const swapRouteLength = swapPathArray.length;

  // Ensure that the swapPathArray length is greater than 0 and less than or equal to the route limit
  assert(
    swapRouteLength > 0 && swapRouteLength <= routeLimitStored,
    'INVALID_SWAP_PATH_ARRAY_LENGTH',
  );

  const callerAddress = Context.caller();
  const contractAddress = Context.callee();

  let lastAmountOut = u256.Zero;

  // Force the swap to have isTransferFrom set to true at the first swap
  swapPathArray[0].isTransferFrom = true;

  if (swapRouteLength > 1) {
    // Add support for multiple swaps
    for (let i = 0; i < swapRouteLength; i++) {
      const swapPath = swapPathArray[i];

      const amoutOut = _swap(
        swapPath,
        callerAddress,
        contractAddress,
        swapPath.receiverAddress,
        coinsOnEachSwap,
      );

      // Update the amountIn for the next swap if it's not the last swap and the swap isTransferFrom is false which will mean that this is not multiswap by splitting the original amoutn by different pools but it is is a multihop swap
      if (i < swapRouteLength - 1) {
        const nextSwapPath = swapPathArray[i + 1];

        // Force the next swap to have isTransferFrom set to true if the next swap pool is not the receiver of the current swap
        if (nextSwapPath.poolAddress != swapPath.receiverAddress) {
          nextSwapPath.isTransferFrom = true;
        }

        if (!nextSwapPath.isTransferFrom) {
          nextSwapPath.amountIn = amoutOut;
        }
      }

      // Update the lastAmountOut
      lastAmountOut = amoutOut;
    }
  } else {
    const swapPath = swapPathArray[0];

    lastAmountOut = _swap(
      swapPath,
      callerAddress,
      contractAddress,
      swapPath.receiverAddress,
      coinsOnEachSwap,
    );
  }

  // Transfer remaining balance to the caller
  transferRemaining(SCBalance, balance(), sent, callerAddress);

  // End the reentrancy guard
  ReentrancyGuard.endNonReentrant();

  // Ensure that the deadline has not expired
  _ensureDeadlineNotExpired(deadline);

  return u256ToBytes(lastAmountOut);
}

/**
 * Set the route limit length
 * @param binaryArgs
 *  - routeLimit - The route limit length
 * @returns void
 */
export function setRouteLimit(binaryArgs: StaticArray<u8>): void {
  // Start reentrancy guard
  ReentrancyGuard.nonReentrant();

  // Only owner of registery can set route limit
  _onlyRegistryOwner();

  const args = new Args(binaryArgs);

  const routeLimitIn = args.nextI32().expect('Invalid route limit');

  assert(
    routeLimitIn >= DEFAULT_ROUTE_LENGTH_LIMIT,
    'ROUTE_LIMIT_MUST_BE_GREATER_THAN_DEFAULT_ROUTE_LENGTH_LIMIT',
  );

  // Store the new route limit
  Storage.set(routeLimitKey, i32ToBytes(routeLimitIn));

  // End reentrancy guard
  ReentrancyGuard.endNonReentrant();

  generateEvent(`Set Route Limit to :  ${routeLimitIn}`);
}

/**
 * Get the route limit length
 * @returns The route limit length
 */
export function getRouteLimit(): StaticArray<u8> {
  return Storage.get(routeLimitKey);
}

/**
 * Helper function to call the swap function on the pool contract.
 * @param swapPath - The swap path object.
 * @param callerAddress - The address of the caller.
 * @param contractAddress - The address of the contract.
 * @param toAddress - The address to transfer the tokens to.
 * @param coinsOnEachSwap - The storage coins to use on each swap.
 * @returns
 */
function _swap(
  swapPath: SwapPath,
  callerAddress: Address,
  contractAddress: Address,
  toAddress: Address,
  coinsOnEachSwap: u64,
): u256 {
  const poolAddress = swapPath.poolAddress;
  const tokenInAddress = swapPath.tokenInAddress.toString();
  const tokenOutAddress = swapPath.tokenOutAddress.toString();
  const amountIn = swapPath.amountIn;
  const minAmountOut = swapPath.minAmountOut;
  const isNativeCoinIn =
    tokenInAddress == NATIVE_MAS_COIN_ADDRESS ? true : false;
  const isNativeCoinOut =
    tokenOutAddress == NATIVE_MAS_COIN_ADDRESS ? true : false;
  const originalCaller = Context.caller();

  // Check if the amountIn is greater than 0
  assert(amountIn > u256.Zero, 'AmountIn must be greater than 0');

  // Check if the minAmountOut is greater than 0
  assert(minAmountOut > u256.Zero, 'minAmountOut must be greater than 0');

  let amountOut = u256.Zero;

  const pool = new IBasicPool(poolAddress);

  const tokenIn = new IMRC20(swapPath.tokenInAddress);

  if (swapPath.isTransferFrom) {
    if (isNativeCoinIn) {
      // Wrap mas before swap and transfer wmas
      const registryContractAddressStored = bytesToString(
        Storage.get(registryContractAddress),
      );

      // Get the wmas token address
      const wmasTokenAddressStored = new Address(
        new IRegistery(
          new Address(registryContractAddressStored),
        ).getWmasTokenAddress(),
      );

      // Wrap Mas to WMAS
      wrapMasToWMAS(amountIn, wmasTokenAddressStored);

      // Transfer wmas to the pool contract
      new IMRC20(wmasTokenAddressStored).transfer(
        poolAddress,
        amountIn,
        getBalanceEntryCost(
          wmasTokenAddressStored.toString(),
          poolAddress.toString(),
        ),
      );

      // Call the swap internal function
      amountOut = pool.swap(
        wmasTokenAddressStored.toString(),
        amountIn,
        minAmountOut,
        toAddress,
        originalCaller,
        false,
        coinsOnEachSwap,
      );
    } else {
      // Check for balance
      const tokenInBalance = tokenIn.balanceOf(callerAddress);

      assert(tokenInBalance >= amountIn, 'INSUFFICIENT_TOKEN_IN_BALANCE');

      const tokenInAllownace = tokenIn.allowance(
        callerAddress,
        contractAddress,
      );

      // Check for allowance
      assert(tokenInAllownace >= amountIn, 'INSUFFICIENT_TOKEN_IN_ALLOWANCE');

      // Transfer amountIn from user to this contract
      tokenIn.transferFrom(
        callerAddress,
        contractAddress,
        amountIn,
        getBalanceEntryCost(tokenInAddress, contractAddress.toString()),
      );

      // Transfer tokens to the pool contract
      tokenIn.transfer(
        poolAddress,
        amountIn,
        getBalanceEntryCost(tokenInAddress, poolAddress.toString()),
      );

      // Call the swap function on the pool contract
      amountOut = pool.swap(
        tokenInAddress,
        amountIn,
        minAmountOut,
        toAddress,
        originalCaller,
        isNativeCoinOut,
        coinsOnEachSwap,
      );
    }
  } else {
    // Call the swap function on the pool contract
    amountOut = pool.swap(
      tokenInAddress,
      amountIn,
      minAmountOut,
      toAddress,
      originalCaller,
      isNativeCoinOut,
      coinsOnEachSwap,
    );
  }

  // Emit swap details events
  generateEvent(`Swap Route Exexcuted: ${swapPath.toString()}`);

  return amountOut;
}

/**
 * Checks if the caller is the owner of the registry contract.
 * @param registryAddress The address of the registry contract.
 * @returns void
 */
function _onlyRegistryOwner(
  registryAddress: string = bytesToString(Storage.get(registryContractAddress)),
): void {
  const registry = new IRegistery(new Address(registryAddress));

  assert(
    Context.caller().toString() == registry.ownerAddress(),
    'CALLER_IS_NOT_REGISTRY_OWNER',
  );
}
