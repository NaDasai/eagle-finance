import {
  Args,
  bytesToF64,
  bytesToString,
  byteToBool,
  u256ToBytes,
} from '@massalabs/as-types';
import { Address, call } from '@massalabs/massa-as-sdk';
import { Pool } from '../structs/pool';
import { u256 } from 'as-bignum/assembly';

export class IRegistery {
  _origin: Address;

  /**
   * Wraps a registry smart contract address in an interface.
   *
   * @param {Address} _address - Address of the smart contract.
   */
  constructor(_address: Address) {
    this._origin = _address;
  }

  /**
   * Calls the `constructor` function of the registry contract.
   * @param {f64} feeShareProtocol - Protocol fee share.
   * @param {string} wmasTokenAddress - Address of the WMAS token.
   */
  init(feeShareProtocol: f64, wmasTokenAddress: string): void {
    const args = new Args().add(feeShareProtocol).add(wmasTokenAddress);
    call(this._origin, 'constructor', args, 0);
  }

  /**
   * Calls the `createNewPool` function of the registry contract.
   *
   * @param {string} aTokenAddress - Address of Token A.
   * @param {string} bTokenAddress - Address of Token B.
   * @param {f64} inputFeeRate - Input fee rate.
   */
  createNewPool(
    aTokenAddress: string,
    bTokenAddress: string,
    inputFeeRate: f64,
  ): void {
    const args = new Args()
      .add(aTokenAddress)
      .add(bTokenAddress)
      .add(inputFeeRate);

    call(this._origin, 'createNewPool', args, 0);
  }

  /**
   * Calls the `createNewPoolWithLiquidity` function of the registry contract.
   *
   * @param {string} aTokenAddress - Address of Token A.
   * @param {string} bTokenAddress - Address of Token B.
   * @param {u256} aAmount - Amount of Token A.
   * @param {u256} bAmount - Amount of Token B.
   * @param {u256} minAmountA - Minimum amount of Token A to receive.
   * @param {u256} minAmountB - Minimum amount of Token B to receive.
   * @param {f64} inputFeeRate - Input fee rate.
   */
  createNewPoolWithLiquidity(
    aTokenAddress: string,
    bTokenAddress: string,
    aAmount: u256,
    bAmount: u256,
    minAmountA: u256,
    minAmountB: u256,
    inputFeeRate: f64,
  ): void {
    const args = new Args()
      .add(aTokenAddress)
      .add(bTokenAddress)
      .add(aAmount)
      .add(bAmount)
      .add(minAmountA)
      .add(minAmountB)
      .add(inputFeeRate);
    call(this._origin, 'createNewPoolWithLiquidity', args, 0);
  }

  /**
   * Calls the `getPools` function of the registry contract to retrieve all pools.
   *
   * @returns {Pool[]} An array of Pool objects.
   */
  getPools(): Pool[] {
    const result = call(this._origin, 'getPools', new Args(), 0);
    const args = new Args(result);
    const pools: Pool[] = args.nextSerializableObjectArray<Pool>().unwrap();

    return pools;
  }

  /**
   * calls the `getFeeShareProtocol` function of the registry contract.
   * @returns {f64} The fee share protocol.
   */
  getFeeShareProtocol(): f64 {
    return bytesToF64(call(this._origin, 'getFeeShareProtocol', new Args(), 0));
  }

  /**
   *  calls the `getFeeShareProtocolReceiver` function of the registry contract.
   * @returns {string} The address of the protocol fee receiver.
   */
  getFeeShareProtocolReceiver(): string {
    return bytesToString(
      call(this._origin, 'getFeeShareProtocolReceiver', new Args(), 0),
    );
  }

  /**
   * Transfers ownership of the registry contract.
   *
   * @param {string} newOwner - Address of the new owner.
   */
  transferOwnership(newOwner: string): void {
    const args = new Args().add(newOwner);
    call(this._origin, 'transferOwnership', args, 0);
  }

  /**
   * Gets the owner of the registry contract.
   *
   * @returns {string} The owner's address.
   */
  ownerAddress(): string {
    return bytesToString(call(this._origin, 'ownerAddress', new Args(), 0));
  }

  /**
   * Checks if the caller is the owner of the contract.
   *
   * @returns {bool} True if the caller is the owner, otherwise false.
   */
  isOwner(address: string): bool {
    const args = new Args().add(address);
    return byteToBool(call(this._origin, 'isOwner', args, 0));
  }

  /**
   * Set the fee share protocol receiver
   * @param {string} receiver  The fee share protocol receiver
   * @returns  void
   */
  setFeeShareProtocolReceiver(receiver: string): void {
    const args = new Args().add(receiver);
    call(this._origin, 'setFeeShareProtocolReceiver', args, 0);
  }

  /**
   * modifier to check if the caller is the owner of the contract.
   *  Throws an error if the caller is not the owner.
   */
  onlyOwner(): void {
    call(this._origin, 'onlyOwner', new Args(), 0);
  }

  /**
   * Calls the `getWmasTokenAddress` function of the registry contract.
   * @returns {string} The address of the WMAS token.
   */
  getWmasTokenAddress(): string {
    return bytesToString(
      call(this._origin, 'getWmasTokenAddress', new Args(), 0),
    );
  }

  /**
   * Calls the `setWmasTokenAddress` function of the registry contract.
   * @param {string} wmasTokenAddress - Address of the WMAS token.
   */
  setWmasTokenAddress(wmasTokenAddress: string): void {
    const args = new Args().add(wmasTokenAddress);
    call(this._origin, 'setWmasTokenAddress', args, 0);
  }
}
