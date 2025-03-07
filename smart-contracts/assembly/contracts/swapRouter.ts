import {
  Address,
  assertIsSmartContract,
  balance,
  Context,
  createEvent,
  generateEvent,
  Storage,
} from '@massalabs/massa-as-sdk';
import { _setOwner } from '../utils/ownership-internal';
import { Args, bytesToString, stringToBytes } from '@massalabs/as-types';
import { SwapPath } from '../structs/swapPath';
import { IBasicPool } from '../interfaces/IBasicPool';
import { NATIVE_MAS_COIN_ADDRESS } from '../utils/constants';
import { IMRC20 } from '../interfaces/IMRC20';
import { getBalanceEntryCost } from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20-external';
import { IRegistery } from '../interfaces/IRegistry';
import { u256 } from 'as-bignum/assembly';
import { transferRemaining, wrapMasToWMAS } from '../utils';
import { ReentrancyGuard } from '../lib/ReentrancyGuard';

const registryContractAddress = stringToBytes('registry');

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

  // Initialize the ReentrancyGuard
  ReentrancyGuard.__ReentrancyGuard_init();
}

export function swap(binaryArgs: StaticArray<u8>): void {
  // Start the reentrancy guard
  ReentrancyGuard.nonReentrant();

  // Get the current balance of the smart contract
  const SCBalance = balance();
  // Get the coins transferred to the smart contract
  const sent = Context.transferredCoins();

  const args = new Args(binaryArgs);

  // Read the swap Path array args
  const swapPathArray = args
    .nextSerializableObjectArray<SwapPath>()
    .expect('Invalid swap path array');

  // Read coins to use on each swap
  const coinsOnEachSwap = args.nextU64().expect('Invalid coins');

  assert(swapPathArray.length > 0, 'Swap Route is empty');

  const callerAddress = Context.caller();
  const contractAddress = Context.callee();

  const swapRouteLength = swapPathArray.length;

  if (swapRouteLength > 1) {
    // Add support for multiple swaps
    for (let i = 0; i < swapRouteLength; i++) {
      const swapPath = swapPathArray[i];

      const toAddress =
        i == swapRouteLength - 1
          ? callerAddress
          : swapPathArray[i + 1].poolAddress;

      const isFirstPath = i == 0 ? true : false;

      _swap(
        swapPath,
        callerAddress,
        contractAddress,
        toAddress,
        coinsOnEachSwap,
        isFirstPath,
      );
    }
  } else {
    const swapPath = swapPathArray[0];

    _swap(
      swapPath,
      callerAddress,
      contractAddress,
      callerAddress,
      coinsOnEachSwap,
      true,
    );
  }

  // Transfer remaining balance to the caller
  transferRemaining(SCBalance, balance(), sent, callerAddress);

  // End the reentrancy guard
  ReentrancyGuard.endNonReentrant();
}

function _swap(
  swapPath: SwapPath,
  callerAddress: Address,
  contractAddress: Address,
  toAddress: Address,
  coinsOnEachSwap: u64,
  isFirstPath: bool = false,
): void {
  const poolAddress = swapPath.poolAddress;
  const tokenInAddress = swapPath.tokenInAddress.toString();
  const tokenOutAddress = swapPath.tokenOutAddress.toString();
  const amountIn = swapPath.amountIn;
  const minAmountOut = swapPath.minAmountOut;
  const isNativeCoinIn =
    tokenInAddress == NATIVE_MAS_COIN_ADDRESS ? true : false;
  const isNativeCoinOut =
    tokenOutAddress == NATIVE_MAS_COIN_ADDRESS ? true : false;

  // Check if the amountIn is greater than 0
  assert(amountIn > u256.Zero, 'AmountIn must be greater than 0');

  // Check if the minAmountOut is greater than 0
  assert(minAmountOut > u256.Zero, 'minAmountOut must be greater than 0');

  const pool = new IBasicPool(poolAddress);

  const tokenIn = new IMRC20(swapPath.tokenInAddress);

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
    pool.swap(
      wmasTokenAddressStored.toString(),
      amountIn,
      minAmountOut,
      toAddress,
      false,
      coinsOnEachSwap,
    );
  } else {
    if (isFirstPath) {
      // Check for balance
      const tokenInBalance = tokenIn.balanceOf(callerAddress);

      assert(tokenInBalance >= amountIn, 'Insufficient balance for tokenIn');

      const tokenInAllownace = tokenIn.allowance(
        callerAddress,
        contractAddress,
      );

      // Check for allowance
      assert(
        tokenInAllownace >= amountIn,
        'Insufficient allowance for tokenIn' +
          amountIn.toString() +
          ' ' +
          tokenInAllownace.toString(),
      );

      // Transfer amountIn from user to this contract
      tokenIn.transferFrom(
        callerAddress,
        contractAddress,
        amountIn,
        getBalanceEntryCost(tokenInAddress, contractAddress.toString()),
      );

      // Transfer tokens to the pool contract
      tokenIn.transfer(poolAddress, amountIn);
    }

    // Call the swap function on the pool contract
    pool.swap(
      tokenInAddress,
      amountIn,
      minAmountOut,
      toAddress,
      isNativeCoinOut,
      coinsOnEachSwap,
    );
  }

  // Emit swap details events
  generateEvent(`Swap Route Exexcuted: ${swapPath.toString()}`);
}
