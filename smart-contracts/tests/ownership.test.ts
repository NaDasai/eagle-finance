import { Account, SmartContract, Web3Provider } from '@massalabs/massa-web3';
import { beforeAll, describe, expect, test } from 'vitest';
import { deployRegistryContract } from './calls/registry';
import * as dotenv from 'dotenv';
import { getContractOwner, transferOwnership } from './calls/ownership';

dotenv.config();

const user1Provider = Web3Provider.buildnet(await Account.fromEnv());

const user2Provider = Web3Provider.buildnet(
  await Account.fromEnv('PRIVATE_KEY_TWO'),
);

const wmasAddress = 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';

let registryContract: SmartContract;

describe('Registry Ownership', () => {
  beforeAll(async () => {
    registryContract = await deployRegistryContract(user1Provider, wmasAddress);
  });

  test('Registry owner should be the deployer', async () => {
    const owner = await getContractOwner(registryContract);

    expect(owner).toBe(user1Provider.address);
  });

  test('Registry owner should be able to transfer ownership', async () => {
    const newOwner = user2Provider.address;

    await transferOwnership(registryContract, newOwner);

    const newOwnerAddress = await getContractOwner(registryContract);

    expect(newOwnerAddress).toBe(newOwner);
  });

  test('Non Registry Owner should not be able to transfer ownership', async () => {
    const newOwner = user1Provider.address;

    await expect(
      transferOwnership(registryContract, newOwner),
    ).rejects.toThrowError(
      'readonly call failed: VM Error in ReadOnlyExecutionTarget::FunctionCall context: VM execution error: RuntimeError: Runtime error: error: Caller is not the owner at ~lib/@massalabs/sc-standards/assembly/contracts/utils/ownership-internal.ts:49 col: 3',
    );
  });
});
describe('Basic Pool OwnerShip');
describe('Token Deployer OwnerShip');
