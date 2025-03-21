import {
  Args,
  boolToByte,
  byteToBool,
  stringToBytes,
  u256ToBytes,
} from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';
import {
  Address,
  balance,
  Context,
  generateEvent,
  isDeployingContract,
  Storage,
} from '@massalabs/massa-as-sdk';
import {
  _allowance,
  _approve,
  _balance,
  _setBalance,
} from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20-internals';
import { _mint } from '@massalabs/sc-standards/assembly/contracts/MRC20/mintable/mint-internal';
import {
  _burn,
  _decreaseTotalSupply,
} from '@massalabs/sc-standards/assembly/contracts/MRC20/burnable/burn-internal';
import {
  onlyOwner,
  setOwner,
} from '@massalabs/sc-standards/assembly/contracts/utils/ownership';
import {
  NAME_KEY,
  DECIMALS_KEY,
  SYMBOL_KEY,
  TOTAL_SUPPLY_KEY,
} from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20';
import { transferRemaining } from '../utils';

const TRANSFER_EVENT_NAME = 'TRANSFER SUCCESS';
const BURN_EVENT = 'BURN_SUCCESS';
const PAUSE_EVENT = 'PAUSE_SUCCESS';
const UNPAUSE_EVENT = 'UNPAUSE_SUCCESS';

export const TOKEN_IMAGE = stringToBytes('TOKEN_IMAGE');
export const TOKEN_DESCRIPTION = stringToBytes('TOKEN_DESCRIPTION');
export const TOKEN_WEBSITE = stringToBytes('TOKEN_WEBSITE');
export const PAUSED = stringToBytes('PAUSED');
export const PAUSABLE = stringToBytes('PAUSABLE');
export const MINTABLE = stringToBytes('MINTABLE');
export const BURNABLE = stringToBytes('BURNABLE');

export function constructor(binaryArgs: StaticArray<u8>): void {
  assert(isDeployingContract());

  const args = new Args(binaryArgs);

  // Admin arg passed by the token deployer to specify the owner of the token
  const admin = args.nextString().expect('Invalid admin');
  const tokenName = args.nextString().expect('Invalid token name');
  const tokenSymbol = args.nextString().expect('Invalid token symbol');
  const decimals = args.nextU8().expect('Invalid decimals');
  const totalSupply = args.nextU256().expect('Invalid total supply');
  // optional parameter
  const image = args.nextString().unwrapOrDefault();
  // optional Parameter
  const website = args.nextString().unwrapOrDefault();
  // optional parameter
  const description = args.nextString().unwrapOrDefault();
  // Optional parameter repreesenting if the token is pausable or not (default false)
  const pausableInput = args.nextBool().unwrapOrDefault();
  // optional parameter representing if the token is mintable or not (default false)
  const mintableInput = args.nextBool().unwrapOrDefault();
  // optional parameter representing if the token is burnable or not (default false)
  const burnableInput = args.nextBool().unwrapOrDefault();

  // Get the current balance of the smart contract
  const SCBalance = balance();
  // Get the coins transferred to the smart contract
  const sent = Context.transferredCoins();

  Storage.set(NAME_KEY, stringToBytes(tokenName));
  Storage.set(SYMBOL_KEY, stringToBytes(tokenSymbol));
  Storage.set(DECIMALS_KEY, [decimals]);
  Storage.set(TOTAL_SUPPLY_KEY, u256ToBytes(totalSupply));
  Storage.set(TOKEN_IMAGE, stringToBytes(image));
  Storage.set(TOKEN_DESCRIPTION, stringToBytes(description));
  Storage.set(TOKEN_WEBSITE, stringToBytes(website));
  Storage.set(PAUSABLE, boolToByte(pausableInput));
  Storage.set(MINTABLE, boolToByte(mintableInput));
  Storage.set(BURNABLE, boolToByte(burnableInput));

  Storage.set(PAUSED, boolToByte(false));

  setOwner(new Args().add(admin).serialize());

  _setBalance(new Address(admin), totalSupply);

  // Transfer the remaining coins to the caller
  transferRemaining(SCBalance, balance(), sent, new Address(admin));

  generateEvent(`Token ${tokenName} deployed.`);
}

export function image(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(TOKEN_IMAGE);
}

export function website(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(TOKEN_WEBSITE);
}

export function description(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(TOKEN_DESCRIPTION);
}

/**
 * Returns if the token supports pausable or not.
 */
export function pausable(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(PAUSABLE);
}

/**
 * Returns if the token is paused or not.
 * @param _ - Unused parameter.
 * @returns A byte array representing the paused status of the token.
 */
export function paused(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(PAUSED);
}

/**
 * Returns if the token supports minting or not.
 */
export function mintable(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(MINTABLE);
}

/**
 * Returns if the token supports burning or not.
 */
export function burnable(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(BURNABLE);
}

/**
 * Pauses the token contract, preventing any transfers or other state changes.
 * Only the contract owner can call this function.
 */
export function pause(_: StaticArray<u8>): void {
  // Only tokens that are pausable can be paused
  _requirePausable();

  // Only the owner can pause the token
  onlyOwner();

  // Set the PAUSED flag to true
  Storage.set(PAUSED, boolToByte(true));

  // Generate an event to indicate that the token has been paused
  generateEvent(PAUSE_EVENT);
}

/**
 * Unpauses the token contract, allowing transfers and other state changes.
 * Only the contract owner can call this function.
 */
export function unpause(_: StaticArray<u8>): void {
  // Only tokens that are pausable can be unpaused
  _requirePausable();

  // Only the owner can unpause the token
  onlyOwner();
  // Set the paused flag to false
  Storage.set(PAUSED, boolToByte(false));
  // Generate an event to indicate that the token has been unpaused
  generateEvent(UNPAUSE_EVENT);
}

/**
 * Requires that the token is not paused.
 * @throws If the token is paused.
 */
function _requireNotPaused(): void {
  // Only require not paused if the token is pausable
  if (byteToBool(Storage.get(PAUSABLE))) {
    // Get the pausable flag from storage
    const pausedStored = byteToBool(Storage.get(PAUSED));

    // If the token is paused, revert
    assert(pausedStored === false, 'TOKEN_PAUSED');
  }
}

/**
 * Requires that the token supports pausable feature
 */
function _requirePausable(): void {
  const pausableStored = byteToBool(Storage.get(PAUSABLE));
  assert(pausableStored, 'TOKEN_NOT_PAUSABLE');
}

/**
 * Requires that the token supprots minting feature
 */
function _requireMintable(): void {
  const mintableStored = byteToBool(Storage.get(MINTABLE));
  assert(mintableStored, 'TOKEN_NOT_MINTABLE');
}

/**
 * Requires that the token supports burning feature
 */
function _requireBurnable(): void {
  const burnableStored = byteToBool(Storage.get(BURNABLE));
  assert(burnableStored, 'TOKEN_NOT_BURNABLE');
}

/**
 * Transfers tokens from the caller's account to the recipient's account.
 *
 * @param from - sender address
 * @param to - recipient address
 * @param amount - number of token to transfer
 *
 * @returns true if the transfer is successful
 */
function _transfer(from: Address, to: Address, amount: u256): void {
  // Transfer should be allowed only if the token is not paused
  _requireNotPaused();

  assert(from != to, 'Transfer failed: cannot send tokens to own account');

  const currentFromBalance = _balance(from);
  const currentToBalance = _balance(to);
  // @ts-ignore
  const newToBalance = currentToBalance + amount;

  assert(currentFromBalance >= amount, 'Transfer failed: insufficient funds');
  assert(newToBalance >= currentToBalance, 'Transfer failed: overflow');
  // @ts-ignore
  _setBalance(from, currentFromBalance - amount);
  _setBalance(to, newToBalance);
}

/**
 * Transfers tokens from the caller's account to the recipient's account.
 *
 * @param binaryArgs - Args object serialized as a string containing:
 * - the recipient's account (address)
 * - the number of tokens (u256).
 */
export function transfer(binaryArgs: StaticArray<u8>): void {
  const owner = Context.caller();

  const args = new Args(binaryArgs);
  const toAddress = new Address(
    args.nextString().expect('receiverAddress argument is missing or invalid'),
  );
  const amount = args
    .nextU256()
    .expect('amount argument is missing or invalid');

  _transfer(owner, toAddress, amount);

  generateEvent(TRANSFER_EVENT_NAME);
}

/**
 * Transfers token ownership from the owner's account to the recipient's account
 * using the spender's allowance.
 *
 * This function can only be called by the spender.
 * This function is atomic:
 * - both allowance and transfer are executed if possible;
 * - or if allowance or transfer is not possible, both are discarded.
 *
 * @param binaryArgs - Args object serialized as a string containing:
 * - the owner's account (address);
 * - the recipient's account (address);
 * - the amount (u256).
 */
export function transferFrom(binaryArgs: StaticArray<u8>): void {
  const spenderAddress = Context.caller();

  const args = new Args(binaryArgs);
  const owner = new Address(
    args.nextString().expect('ownerAddress argument is missing or invalid'),
  );
  const recipient = new Address(
    args.nextString().expect('recipientAddress argument is missing or invalid'),
  );
  const amount = args
    .nextU256()
    .expect('amount argument is missing or invalid');

  const spenderAllowance = _allowance(owner, spenderAddress);

  assert(
    spenderAllowance >= amount,
    'transferFrom failed: insufficient allowance',
  );

  _transfer(owner, recipient, amount);

  // @ts-ignore
  _approve(owner, spenderAddress, spenderAllowance - amount);

  generateEvent(TRANSFER_EVENT_NAME);
}

/**
 *  Mint tokens on the recipient address.
 *  Restricted to the owner of the contract.
 *
 * @param binaryArgs - `Args` serialized StaticArray<u8> containing:
 * - the recipient's account (address)
 * - the amount of tokens to mint (u256).
 */
export function mint(binaryArgs: StaticArray<u8>): void {
  // Token should be mintable
  _requireMintable();

  // Token should be not paused
  _requireNotPaused();

  // Only the owner can mint tokens
  onlyOwner();

  _mint(binaryArgs);
}

/**
 * Burn tokens from the caller address
 *
 * @param binaryArgs - byte string with the following format:
 * - the amount of tokens to burn obn the caller address (u256).
 */
export function burn(binaryArgs: StaticArray<u8>): void {
  // Token should be burnable
  _requireBurnable();

  // Token should be not paused
  _requireNotPaused();

  const args = new Args(binaryArgs);
  const amount = args
    .nextU256()
    .expect('amount argument is missing or invalid');

  _decreaseTotalSupply(amount);

  _burn(Context.caller(), amount);

  generateEvent(BURN_EVENT);
}

/**
 * Burn tokens from the caller address
 *
 * @param binaryArgs - byte string with the following format:
 * - the owner of the tokens to be burned (string).
 * - the amount of tokens to burn on the caller address (u256).
 *
 */
export function burnFrom(binaryArgs: StaticArray<u8>): void {
  // Token should be burnable
  _requireBurnable();

  // Token should be not paused
  _requireNotPaused();

  const args = new Args(binaryArgs);
  const owner = new Address(
    args.nextString().expect('owner argument is missing or invalid'),
  );
  const amount = args
    .nextU256()
    .expect('amount argument is missing or invalid');

  const spenderAllowance = _allowance(owner, Context.caller());

  assert(spenderAllowance >= amount, 'burnFrom failed: insufficient allowance');

  _decreaseTotalSupply(amount);

  _burn(owner, amount);

  // @ts-ignore
  _approve(owner, Context.caller(), spenderAllowance - amount);

  generateEvent(BURN_EVENT);
}

export {
  VERSION,
  version,
  name,
  symbol,
  decimals,
  totalSupply,
  balanceOf,
  allowance,
  increaseAllowance,
  decreaseAllowance,
} from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20';
export { onlyOwner, isOwner, transferOwnership, acceptOwnership, pendingOwnerAddress, ownerAddress } from '../utils/ownership';
