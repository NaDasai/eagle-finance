import { Account, SmartContract, Web3Provider } from '@massalabs/massa-web3';
import { beforeAll, describe, expect, test } from 'vitest';
import {
  createNewPool,
  deployRegistryContract,
  getPools,
} from './calls/registry';
import * as dotenv from 'dotenv';
import { acceptOwnership, getContractOwner, getPendingContractOwner, transferOwnership } from './calls/ownership';
import { deployTokenDeployer } from './calls/token-deployer';

dotenv.config();

const user1Provider = Web3Provider.buildnet(await Account.fromEnv());

const user2Provider = Web3Provider.buildnet(
  await Account.fromEnv('PRIVATE_KEY_TWO'),
);

const wmasAddress = 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';
const aTokenAddress = 'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';

let registryContract: SmartContract;
let poolContract: SmartContract;
let tokenDeployerContract: SmartContract;

describe('Registry Ownership', () => {
  beforeAll(async () => {
    registryContract = await deployRegistryContract(user1Provider, wmasAddress);
  });

  test('Registry owner should be the deployer', async () => {
    const owner = await getContractOwner(registryContract);

    expect(owner).toBe(user1Provider.address);
  });

  test('Non Registry Owner should not be able to start transfer ownership', async () => {
    // switch registry to user2
    registryContract = new SmartContract(
      user2Provider,
      registryContract.address,
    );

    const newOwner = user2Provider.address;

    await expect(
      transferOwnership(registryContract, newOwner),
    ).rejects.toThrowError(
      'readonly call failed: VM Error in ReadOnlyExecutionTarget::FunctionCall context: VM execution error: RuntimeError: Runtime error: error: Caller is not the owner at ~lib/@massalabs/sc-standards/assembly/contracts/utils/ownership-internal.ts:49 col: 3',
    );
  });

  test('Registry owner should be able to start transfer ownership proccess', async () => {
    // switch back registry to user1
    registryContract = new SmartContract(
      user1Provider,
      registryContract.address,
    );

    const newOwner = user2Provider.address;

    await transferOwnership(registryContract, newOwner);

    const pendingOwnerAddress = await getPendingContractOwner(registryContract);

    expect(pendingOwnerAddress).toBe(newOwner);
  });

  test("Non Pending Owner should not be able to accept ownership", async () => {
    await expect(
      acceptOwnership(registryContract),
    ).rejects.toThrowError(
      'readonly call failed: VM Error in ReadOnlyExecutionTarget::FunctionCall context: VM execution error: RuntimeError: Runtime error: error: CALLER_IS_NOT_PENDING_OWNER at assembly/utils/ownership.ts:59 col: 3',
    );
  })

  test("The new Owner should be able to accept ownership", async () => {
    registryContract = new SmartContract(user2Provider, registryContract.address);

    // Accept ownership
    await acceptOwnership(registryContract);

    const owner = await getContractOwner(registryContract);

    // expect the owner to be the new owner after accepting
    expect(owner).toBe(user2Provider.address);

  })
});


describe.skip('Token Deployer OwnerShip', () => {
  beforeAll(async () => {
    tokenDeployerContract = await deployTokenDeployer(user1Provider);
  });

  test('Token Deployer owner should be the deployer', async () => {
    const owner = await getContractOwner(tokenDeployerContract);

    expect(owner).toBe(user1Provider.address);
  });

  test('Token Deployer owner should be able to transfer ownership', async () => {
    const newOwner = user2Provider.address;

    await transferOwnership(tokenDeployerContract, newOwner);

    const newOwnerAddress = await getContractOwner(tokenDeployerContract);

    expect(newOwnerAddress).toBe(newOwner);
  });

  test('Non Token Deployer Owner should not be able to transfer ownership', async () => {
    const newOwner = user1Provider.address;

    await expect(
      transferOwnership(tokenDeployerContract, newOwner),
    ).rejects.toThrowError(
      'readonly call failed: VM Error in ReadOnlyExecutionTarget::FunctionCall context: VM execution error: RuntimeError: Runtime error: error: Caller is not the owner at ~lib/@massalabs/sc-standards/assembly/contracts/utils/ownership-internal.ts:49 col: 3',
    );
  });
});
