/**
 * Accept the pending ownership transfer of the mainnet registry contract.
 *
 * Ownership is a 2-step transfer: the current owner calls `transferOwnership(newOwner)`,
 * then the new owner must call `acceptOwnership` (see assembly/utils/ownership.ts).
 *
 * Usage:
 *   npm run accept-registry-ownership
 *
 * Requirements:
 *   - PRIVATE_KEY in .env must be the pending owner of the registry.
 */
import {
  Account,
  Args,
  bytesToStr,
  OperationStatus,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';

// Load PRIVATE_KEY from .env, Account.fromEnv only reads process.env
dotenv.config();

const REGISTRY_ADDRESS = 'AS1NYihs2Wy4D4P68JGY2hYSDDaqZ5YxhM2nDRsJVFZUykEEdSAW';

const account = await Account.fromEnv();
const provider = Web3Provider.mainnet(account);
const registry = new SmartContract(provider, REGISTRY_ADDRESS);

const caller = account.address.toString();

async function readOwner(): Promise<string> {
  return bytesToStr((await registry.read('ownerAddress')).value);
}

const currentOwner = await readOwner();
// Returns an empty string when no transfer is pending
const pendingOwner = bytesToStr(
  (await registry.read('pendingOwnerAddress')).value,
);

console.log(`Registry: ${REGISTRY_ADDRESS}`);
console.log(`Caller: ${caller}`);
console.log(`Current owner: ${currentOwner}`);
console.log(`Pending owner: ${pendingOwner || '(none)'}\n`);

if (currentOwner === caller) {
  console.log('Caller is already the registry owner, nothing to do.');
  process.exit(0);
}

// Check before sending, otherwise the tx reverts with CALLER_IS_NOT_PENDING_OWNER and burns fees
if (pendingOwner !== caller) {
  throw new Error(
    `Caller ${caller} is not the pending owner (${
      pendingOwner || 'none'
    }). Aborting.`,
  );
}

const operation = await registry.call(
  'acceptOwnership',
  new Args().serialize(),
);
console.log(`Operation sent: ${operation.id}`);

// Wait for finality (not just speculative) since this is a one-off, high-impact change
const status = await operation.waitFinalExecution();

if (status !== OperationStatus.Success) {
  console.log('Status:', status);
  console.log('Events:', await operation.getFinalEvents());
  throw new Error('Failed to accept ownership');
}

const newOwner = await readOwner();
console.log(`\nOwnership accepted. Registry owner is now: ${newOwner}`);
