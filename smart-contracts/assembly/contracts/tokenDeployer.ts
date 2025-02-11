import {
  Args,
  Result,
  serializableObjectsArrayToBytes,
  stringToBytes,
} from '@massalabs/as-types';
import {
  Address,
  balance,
  Context,
  createEvent,
  createSC,
  fileToByteArray,
  generateEvent,
  generateRawEvent,
  isDeployingContract,
  Storage,
  validateAddress,
} from '@massalabs/massa-as-sdk';
import { IMRC20 } from '../interfaces/IMRC20';
import {
  deserializeStringArray,
  serializeStringArray,
  transferRemaining,
} from '../utils';
import { _setOwner } from '../utils/ownership-internal';
import { ReentrancyGuard } from '../lib/ReentrancyGuard';
import { PersistentMap } from '../lib/PersistentMap';

// Persistent map to store the tokens deployed and the address of the deployer
const tokens = new PersistentMap<Address, Address>('TOKENS');

/**
 * Constructor for the token deployer contract.
 * @returns void
 */
export function constructor(_: StaticArray<u8>): void {
  // This line is important. It ensures that this function can't be called in the future.
  // If you remove this check, someone could call your constructor function and reset your smart contract.
  assert(isDeployingContract());

  // Set the contract owner
  _setOwner(Context.caller().toString());

  // Initialize the reentrancy guard
  ReentrancyGuard.__ReentrancyGuard_init();

  generateEvent(`Token Deployer deployed.`);
}

/**
 * Create a new token and deploy it on the blockchain.
 * @param binaryArgs - The binary arguments for creating the token.(tokenName, tokenSymbol, decimals, totalSupply, url, description)
 * @returns void
 */
export function createNewToken(binaryArgs: StaticArray<u8>): void {
  // Start Reentrancy guard
  ReentrancyGuard.nonReentrant();

  const args = new Args(binaryArgs);

  const tokenName = args.nextString().expect('Invalid token name');
  const tokenSymbol = args.nextString().expect('Invalid token symbol');
  const decimals = args.nextU8().expect('Invalid decimals');
  const totalSupply = args.nextU256().expect('Invalid total supply');
  // Optional parameter
  const url = args.nextString().unwrapOrDefault();
  // Optional parameter
  const description = args.nextString().unwrapOrDefault();
  // Optional parameter representng that the token is pausable or not. Default value is false.
  const pausable = args.nextBool().unwrapOrDefault();
  // Optional parameter that specifies if the token is mintable or not. Default value is false.
  const mintable = args.nextBool().unwrapOrDefault();
  // Optional parameter that specifies if the token is burnable or not. Default value is false.
  const burnable = args.nextBool().unwrapOrDefault();
  // Optional parameter that specifies the coins to use on deploy the new token.
  // Default value is 0.005 MAS, which is the minimum required to deploy a token contract.
  // Check storage costs documentation for more details at https://docs.massa.net/docs/learn/storage-costs
  const coinsToUseOnDeployIn: Result<u64> = args.nextU64();
  let coinsToUseOnDeploy: u64;

  // IsErr() returns true, if coinsToUseOnDeployIn is not passed or some error occurs
  if (coinsToUseOnDeployIn.isErr()) {
    // default value
    coinsToUseOnDeploy = u64(5 * 10 ** 7);
  } else {
    coinsToUseOnDeploy = coinsToUseOnDeployIn.unwrap();
  }

  // Get the current balance of the smart contract
  const SCBalance = balance();
  // Get the coins transferred to the smart contract
  const sent = Context.transferredCoins();

  // Get the token bytecode
  const tokenByteCode: StaticArray<u8> = fileToByteArray('build/token.wasm');

  // Deploy the token contract
  const tokenAddress = createSC(tokenByteCode);

  // Init the token contract
  const tokenContract = new IMRC20(tokenAddress);

  tokenContract.initExtended(
    Context.caller(),
    tokenName,
    tokenSymbol,
    decimals,
    totalSupply,
    url,
    description,
    pausable,
    mintable,
    burnable,
    coinsToUseOnDeploy,
  );

  // Get the caller address
  const callerAddress = Context.caller();

  // Set the token address in the storage
  tokens.set(tokenAddress, callerAddress);

  // Transfer the remaining coins to the caller
  transferRemaining(SCBalance, balance(), sent, callerAddress);

  // Emit an event
  generateEvent(
    `CREATE_NEW_TOKEN:${Context.callee().toString()}||${callerAddress}||${tokenAddress.toString()}||${tokenName}||${tokenSymbol}||${decimals.toString()}||${totalSupply.toString()}||${url}||${description}||${coinsToUseOnDeploy.toString()}`,
  );

  // Raw event to be able to get the token address at the frotnend by using operation.getDeployedAddress(true)
  generateRawEvent(new Args().add(tokenAddress).serialize());

  // End Reentrancy guard
  ReentrancyGuard.endNonReentrant();
}

// Export ownership functions
export * from '../utils/ownership';
