import { Args, stringToBytes, u256ToBytes } from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';
import {
  Address,
  Context,
  generateEvent,
  isDeployingContract,
  print,
  Storage,
} from '@massalabs/massa-as-sdk';
import {
  _allowance,
  _approve,
  _balance,
  _setBalance,
} from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20-internals';
import { setOwner } from '@massalabs/sc-standards/assembly/contracts/utils/ownership';

export const VERSION = stringToBytes('0.0.1');

const TRANSFER_EVENT_NAME = 'TRANSFER SUCCESS';
const APPROVAL_EVENT_NAME = 'APPROVAL SUCCESS';

export const NAME_KEY = stringToBytes('NAME');
export const SYMBOL_KEY = stringToBytes('SYMBOL');
export const TOTAL_SUPPLY_KEY = stringToBytes('TOTAL_SUPPLY');
export const DECIMALS_KEY = stringToBytes('DECIMALS');
export const TOKEN_URL = stringToBytes('TOKEN_URL');
export const TOKEN_DESCRIPTION = stringToBytes('TOKEN_DESCRIPTION');

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
  const url = args.nextString().unwrapOrDefault();
  // optional parameter
  const description = args.nextString().unwrapOrDefault();

  Storage.set(NAME_KEY, stringToBytes(tokenName));
  Storage.set(SYMBOL_KEY, stringToBytes(tokenSymbol));
  Storage.set(DECIMALS_KEY, [decimals]);
  Storage.set(TOTAL_SUPPLY_KEY, u256ToBytes(totalSupply));
  Storage.set(TOKEN_URL, stringToBytes(url));
  Storage.set(TOKEN_DESCRIPTION, stringToBytes(description));

  setOwner(new Args().add(admin).serialize());

  _setBalance(new Address(admin), totalSupply);

  generateEvent(`Token ${tokenName} deployed.`);
}

export function url(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(TOKEN_URL);
}

export function description(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(TOKEN_DESCRIPTION);
}

/**
 * Returns the version of this smart contract.
 * This versioning is following the best practices defined in https://semver.org/.
 *
 * @param _ - unused see https://github.com/massalabs/massa-sc-std/issues/18
 * @returns token version
 */
export function version(_: StaticArray<u8>): StaticArray<u8> {
  return VERSION;
}

// ======================================================== //
// ====                 TOKEN ATTRIBUTES               ==== //
// ======================================================== //

/**
 * Returns the name of the token.
 *
 * @param _ - unused see https://github.com/massalabs/massa-sc-std/issues/18
 * @returns token name.
 */
export function name(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(NAME_KEY);
}

/** Returns the symbol of the token.
 *
 * @param _ - unused see https://github.com/massalabs/massa-sc-std/issues/18
 * @returns token symbol.
 */
export function symbol(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(SYMBOL_KEY);
}

/**
 * Returns the total token supply.
 *
 * The number of tokens that were initially minted.
 *
 * @param _ - unused see https://github.com/massalabs/massa-sc-std/issues/18
 * @returns u256
 */
export function totalSupply(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(TOTAL_SUPPLY_KEY);
}

/**
 * Returns the maximum number of digits being part of the fractional part
 * of the token when using a decimal representation.
 *
 * @param _ - unused see https://github.com/massalabs/massa-sc-std/issues/18
 * @returns
 */
export function decimals(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(DECIMALS_KEY);
}

// ==================================================== //
// ====                 BALANCE                    ==== //
// ==================================================== //

/**
 * Returns the balance of an account.
 *
 * @param binaryArgs - Args object serialized as a string containing an owner's account (Address).
 */
export function balanceOf(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);

  const addr = new Address(
    args.nextString().expect('Address argument is missing or invalid'),
  );

  return u256ToBytes(_balance(addr));
}

// ==================================================== //
// ====                 TRANSFER                   ==== //
// ==================================================== //

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
 * Transfers tokens from the caller's account to the recipient's account.
 *
 * @param from - sender address
 * @param to - recipient address
 * @param amount - number of token to transfer
 *
 * @returns true if the transfer is successful
 */
function _transfer(from: Address, to: Address, amount: u256): void {
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

// ==================================================== //
// ====                 ALLOWANCE                  ==== //
// ==================================================== //

/**
 * Returns the allowance set on the owner's account for the spender.
 *
 * @param binaryArgs - Args object serialized as a string containing:
 * - the owner's account (address)
 * - the spender's account (address).
 */
export function allowance(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const owner = new Address(
    args.nextString().expect('owner argument is missing or invalid'),
  );
  const spenderAddress = new Address(
    args.nextString().expect('spenderAddress argument is missing or invalid'),
  );

  return u256ToBytes(_allowance(owner, spenderAddress));
}

/**
 * Increases the allowance of the spender on the owner's account by the amount.
 *
 * This function can only be called by the owner.
 *
 * @param binaryArgs - Args object serialized as a string containing:
 * - the spender's account (address);
 * - the amount (u256).
 */
export function increaseAllowance(binaryArgs: StaticArray<u8>): void {
  const owner = Context.caller();

  const args = new Args(binaryArgs);
  const spenderAddress = new Address(
    args.nextString().expect('spenderAddress argument is missing or invalid'),
  );
  const amount = args
    .nextU256()
    .expect('amount argument is missing or invalid');

  // @ts-ignore
  let newAllowance = _allowance(owner, spenderAddress) + amount;
  if (newAllowance < amount) {
    newAllowance = u256.Max;
  }

  _approve(owner, spenderAddress, newAllowance);

  generateEvent(APPROVAL_EVENT_NAME);
}

/**
 * Decreases the allowance of the spender the on owner's account by the amount.
 *
 * This function can only be called by the owner.
 *
 * @param binaryArgs - Args object serialized as a string containing:
 * - the spender's account (address);
 * - the amount (u256).
 */
export function decreaseAllowance(binaryArgs: StaticArray<u8>): void {
  const owner = Context.caller();

  const args = new Args(binaryArgs);
  const spenderAddress = new Address(
    args.nextString().expect('spenderAddress argument is missing or invalid'),
  );
  const amount = args
    .nextU256()
    .expect('amount argument is missing or invalid');

  const current = _allowance(owner, spenderAddress);

  let newAllowance = u256.Zero;

  if (current > amount) {
    // @ts-ignore
    newAllowance = current - amount;
  }

  _approve(owner, spenderAddress, newAllowance);

  generateEvent(APPROVAL_EVENT_NAME);
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
