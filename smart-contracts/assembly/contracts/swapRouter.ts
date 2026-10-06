import {
  Address,
  assertIsSmartContract,
  Context,
  generateEvent,
  Storage,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  bytesToString,
  i32ToBytes,
  stringToBytes,
} from '@massalabs/as-types';
import { DEFAULT_ROUTE_LENGTH_LIMIT } from '../utils/constants';
import { IRegistery } from '../interfaces/IRegistry';
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
 * EMERGENCY: swaps are disabled in this router.
 *
 * The previous router was exploited. This version is deployed only so the
 * registry can point to a router that cannot move any funds. Pools only accept
 * swaps from the router stored in the registry, so this freezes all swaps.
 *
 * The function is kept (same name, same signature) so the contract ABI does not
 * change and front-ends/scripts get a clear error instead of "function not found".
 * To re-enable swaps, deploy a fixed router and point the registry to it.
 *
 * @param _binaryArgs - Ignored.
 * @returns Never returns, always reverts with `SWAPS_DISABLED`.
 */
export function swap(_binaryArgs: StaticArray<u8>): StaticArray<u8> {
  assert(false, 'SWAPS_DISABLED');
  // Unreachable, only here to satisfy the return type.
  return [];
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
