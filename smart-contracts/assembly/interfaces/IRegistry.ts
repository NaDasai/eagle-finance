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

  subscribePool(
    poolAddress: string,
    aTokenAddress: string,
    bTokenAddress: string,
    feeShareProtocol: f64,
    inputFeeRate: f64,
  ): void {
    const args = new Args()
      .add(poolAddress)
      .add(aTokenAddress)
      .add(bTokenAddress)
      .add(feeShareProtocol)
      .add(inputFeeRate);
    call(this._origin, 'subscribePool', args, 0);
  }

  ownerAddress(): string {
    return bytesToString(call(this._origin, 'ownerAddress', new Args(), 0));
  }

  isOwner(address: string): bool {
    const args = new Args().add(address);
    return byteToBool(call(this._origin, 'isOwner', args, 0));
  }

  onlyOwner(): void {
    call(this._origin, 'onlyOwner', new Args(), 0);
  }
}
