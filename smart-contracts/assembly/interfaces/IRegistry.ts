import { Args, bytesToString, byteToBool } from '@massalabs/as-types';
import { Address, call } from '@massalabs/massa-as-sdk';

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
   */
  init(): void {
    call(this._origin, 'constructor', new Args(), 0);
  }

  /**
   * Calls the `createNewPool` function of the registry contract.
   *
   * @param {string} aTokenAddress - Address of Token A.
   * @param {string} bTokenAddress - Address of Token B.
   * @param {f64} feeShareProtocol - Protocol fee share.
   * @param {f64} inputFeeRate - Input fee rate.
   */
  createNewPool(
    aTokenAddress: string,
    bTokenAddress: string,
    feeShareProtocol: f64,
    inputFeeRate: f64,
  ): void {
    const args = new Args()
      .add(aTokenAddress)
      .add(bTokenAddress)
      .add(feeShareProtocol)
      .add(inputFeeRate);

    call(this._origin, 'createNewPool', args, 0);
  }

  /**
   * Calls the `getPools` function of the registry contract to retrieve all pools.
   *
   * @returns {string[]} An array of pool keys.
   */
  getPools(): string[] {
    const result = call(this._origin, 'getPools', new Args(), 0);

    const deserialized = new Args(result).nextStringArray().unwrap();
    return deserialized;
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
   * modifier to check if the caller is the owner of the contract.
   *  Throws an error if the caller is not the owner.
   */
  onlyOwner(): void {
    call(this._origin, 'onlyOwner', new Args(), 0);
  }
}
