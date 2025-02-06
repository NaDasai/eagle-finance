import { Address, Storage } from '@massalabs/massa-as-sdk';
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

export * from '@massalabs/sc-standards/assembly/contracts/utils/ownership';
