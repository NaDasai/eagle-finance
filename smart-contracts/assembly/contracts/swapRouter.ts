/**
 * This smart contract is not intended to be deployed on the Massa blockchain.
 * It is designed to execute multiple swaps in a single transaction.
 * For an example, refer to the following link:
 * https://github.com/massalabs/massa-sc-examples/blob/4ecea9cbfdd59a4410c99f268f35f0485068081d/airdrop/smart-contract/src/airdrop.ts#L28
 */

import {
  Context,
  createEvent,
  generateEvent,
} from '@massalabs/massa-as-sdk';
import { _setOwner } from '../utils/ownership-internal';
import { Args } from '@massalabs/as-types';
import { SwapPath } from '../structs/swapPath';
import { IBasicPool } from '../interfaces/IBasicPool';
import { NATIVE_MAS_COIN_ADDRESS } from '../utils/constants';

export function main(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  // Read the swap Path array args
  const swapPathArray = args
    .nextSerializableObjectArray<SwapPath>()
    .expect('Invalid swap path array');

  // Read coins to use on each swap
  const coinsOnEachSwap = args.nextU64().expect('Invalid coins');

  // Check if the swap path array is empty
  assert(swapPathArray.length > 0, 'Swap path array is empty');

  // Loop through the swap path array
  for (let i = 0; i < swapPathArray.length; i++) {
    const swapPath = swapPathArray[i];

    const poolAddress = swapPath.poolAddress;
    const tokenInAddress = swapPath.tokenInAddress.toString();
    const tokenOutAddress = swapPath.tokenOutAddress.toString();
    const amountIn = swapPath.amountIn;
    const minAmountOut = swapPath.minAmountOut;

    // Init pool contract
    const poolContract = new IBasicPool(poolAddress);

    // Check if token In is the nativecoin
    const isNativeCoinIn =
      tokenInAddress == NATIVE_MAS_COIN_ADDRESS ? true : false;

    // check if it should call swapWithMas or swap
    const isWithMAS =
      isNativeCoinIn || tokenOutAddress == NATIVE_MAS_COIN_ADDRESS
        ? true
        : false;

    // swap the tokens
    if (isWithMAS) {
      const coinsToUse = isNativeCoinIn
        ? coinsOnEachSwap + amountIn.toU64()
        : coinsOnEachSwap;

      poolContract.swapWithMas(
        tokenInAddress,
        amountIn,
        minAmountOut,
        coinsToUse,
      );
    } else {
      poolContract.swap(
        tokenInAddress,
        amountIn,
        minAmountOut,
        coinsOnEachSwap,
      );
    }
  }

  // Emit the event
  generateEvent(
    createEvent('Multiple Swap Executed', [Context.caller().toString()]),
  );
}
