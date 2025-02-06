import { Account, SmartContract, Web3Provider } from '@massalabs/massa-web3';
import { beforeAll, describe, expect, test } from 'vitest';
import {
  createNewPool,
  deployRegistryContract,
  getPools,
} from './calls/registry';
import * as dotenv from 'dotenv';
import { getContractOwner, transferOwnership } from './calls/ownership';
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

describe('Basic Pool OwnerShip', () => {
  beforeAll(async () => {
    registryContract = await deployRegistryContract(user1Provider, wmasAddress);

    // switch registry to user2
    registryContract = new SmartContract(
      user2Provider,
      registryContract.address,
    );

    await createNewPool(registryContract, aTokenAddress, wmasAddress, 0);

    const pools = await getPools(registryContract);

    expect(pools.length > 0, 'No pools found');

    // get the last pool address
    const pool = pools[pools.length - 1].poolAddress;

    poolContract = new SmartContract(user2Provider, pool);
  });

  test('Pool owner should be the deployer of the registry not the pool', async () => {
    const owner = await getContractOwner(poolContract);

    expect(owner).toBe(user1Provider.address);
  });

  test('Pool owner should be able to transfer ownership', async () => {
    // switch to the owner
    poolContract = new SmartContract(user1Provider, poolContract.address);

    const newOwner = user2Provider.address;

    await transferOwnership(poolContract, newOwner);

    const newOwnerAddress = await getContractOwner(poolContract);

    expect(newOwnerAddress).toBe(newOwner);
  });

  test('Non Pool Owner should not be able to transfer ownership', async () => {
    const newOwner = user1Provider.address;

    await expect(
      transferOwnership(poolContract, newOwner),
    ).rejects.toThrowError(
      'readonly call failed: VM Error in ReadOnlyExecutionTarget::FunctionCall context: VM execution error: RuntimeError: Runtime error: error: Caller is not the owner at ~lib/@massalabs/sc-standards/assembly/contracts/utils/ownership-internal.ts:49 col: 3',
    );
  });
});

describe('Token Deployer OwnerShip', () => {
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
