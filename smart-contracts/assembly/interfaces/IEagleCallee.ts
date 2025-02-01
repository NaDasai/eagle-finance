import { Args } from '@massalabs/as-types';
import { Address, call } from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly';

/**
 * Interface for the IEagleCallee smart contract.
 */
export class IEagleCallee {
  /**
   * The address of the smart contract.
   */
  _origin: Address;

  /**
   * Creates a new instance of the IEagleCallee class.
   * @param _address - The address of the smart contract.
   */
  constructor(_address: Address) {
    this._origin = _address;
  }

  /**
   * Invokes the 'eagleCall' function on the smart contract at the specified origin address.
   *
   * @param profitAddress - The address of the profit address.
   * @param aAmount - The first amount parameter of type u256.
   * @param bAmount - The second amount parameter of type u256.
   * @param data - Additional data to be passed as a static array of bytes.
   * @param coins - The amount of coins to be sent with the call. Default is 0.
   */
  eagleCall(
    profitAddress: Address,
    aAmount: u256,
    bAmount: u256,
    data: StaticArray<u8>,
    coins: u64 = 0,
  ): void {
    call(
      this._origin,
      'eagleCall',
      new Args().add(profitAddress).add(aAmount).add(bAmount).add(data),
      coins,
    );
  }

  initFlash(
    aAmount: u256,
    bAmount: u256,
    profitAddress: Address,
    data: StaticArray<u8>,
    coins: u64 = 0,
  ): void {
    call(
      this._origin,
      'initFlash',
      new Args().add(aAmount).add(bAmount).add(profitAddress).add(data),
      coins,
    );
  }
}
