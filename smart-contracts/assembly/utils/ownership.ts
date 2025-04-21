import {
  Address,
  Context,
  generateEvent,
  Storage,
  validateAddress,
} from '@massalabs/massa-as-sdk';
import { Args, stringToBytes } from '@massalabs/as-types';
import {
  OWNER_KEY,
  _isOwner,
  _onlyOwner,
  _setOwner,
} from '@massalabs/sc-standards/assembly/contracts/utils/ownership-internal';

// Storage key for the pending owner
const pendingOwner = 'PENDING_OWNER';

/**
 * Returns the owner address of the contract.
 *
 * @returns The owner address.
 */
export function _ownerAddress(): Address {
  return new Address(Storage.get(OWNER_KEY));
}

/**
 * Transfers the ownership of the contract to a new owner.
 *
 * This function can only be called by the current owner of the contract.
 * It sets a new pending owner in the contract storage.
 *
 * @param binaryArgs - The binary arguments containing the new owner address.
 */
export function transferOwnership(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const newOwner = args.nextString().expect('Invalid new owner');

  // Ensure that the caller is the owner
  _onlyOwner();

  // Ensure that the new owner address is valid address
  assert(validateAddress(newOwner), 'INVALID_OWNER_ADDRESS');

  // Set a new pending owner
  Storage.set(pendingOwner, newOwner);

  // Emit an event
  generateEvent(
    ownershipTransferStartedEvent(_ownerAddress(), new Address(newOwner)),
  );
}

/**
 * Accepts the ownership transfer of the contract.
 *
 * This function can only be called by the pending owner of the contract.
 * It updates the owner in the contract storage and deletes the pending owner.
 */
export function acceptOwnership(): void {
  const caller = Context.caller();
  const storedPendingOwner = Storage.get(pendingOwner);
  const prevOwner = _ownerAddress();

  // Ensure that the caller is the pending owner
  assert(
    caller.toString() === storedPendingOwner,
    'CALLER_IS_NOT_PENDING_OWNER',
  );

  // Set the new owner
  Storage.set(OWNER_KEY, caller.toString());

  // Delete the pending owner
  Storage.del(pendingOwner);

  // Emit an event
  generateEvent(ownershipTransferAcceptedEvent(prevOwner, caller));
}

/**
 * Returns the pending owner address of the contract.
 *
 * @returns The pending owner address.
 */
export function pendingOwnerAddress(): StaticArray<u8> {
  // If there is no pending owner, return an empty address
  if (!Storage.has(pendingOwner)) {
    return stringToBytes('');
  }

  // Return the pending owner address
  return stringToBytes(Storage.get(pendingOwner));
}

function ownershipTransferStartedEvent(
  prevOwner: Address,
  newOwner: Address,
): string {
  return `OWNERSHIP_TRANSFERRED_EVENT_STARTED:${prevOwner.toString()}:${newOwner.toString()}`;
}

function ownershipTransferAcceptedEvent(
  prevOwner: Address,
  newOwner: Address,
): string {
  return `OWNERSHIP_TRANSFERRED_EVENT_ACCEPTED:${prevOwner.toString()}:${newOwner.toString()}`;
}

export * from '@massalabs/sc-standards/assembly/contracts/utils/ownership';
