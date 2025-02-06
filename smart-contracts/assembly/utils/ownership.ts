import { Address, Storage, validateAddress } from '@massalabs/massa-as-sdk';
import { Args, boolToByte, stringToBytes } from '@massalabs/as-types';
import {
  OWNER_KEY,
  _isOwner,
  _onlyOwner,
  _setOwner,
} from '@massalabs/sc-standards/assembly/contracts/utils/ownership-internal';

export function _ownerAddress(): Address {
  return new Address(Storage.get(OWNER_KEY));
}

/**
 * Transfers the ownership of the contract to a new owner.
 *
 * This function can only be called by the current owner of the contract.
 * It validates the new owner address and updates the owner in the contract storage.
 *
 * @param binaryArgs - The binary arguments containing the new owner address.
 */
export function transferOwnership(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const newOwner = args.nextString().expect('Invalid new owner');

  _onlyOwner();

  assert(validateAddress(newOwner), 'INVALID_OWNER_ADDRESS');

  // Set the new owner
  _setOwner(newOwner);
}

export * from '@massalabs/sc-standards/assembly/contracts/utils/ownership';
