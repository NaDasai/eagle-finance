import {
  Account,
  MRC20,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { beforeAll, describe, expect, test } from 'vitest';
import {
  createNewToken,
  deployTokenDeployer,
  getAllTokensAddresses,
} from './calls/token-deployer';
import * as dotenv from 'dotenv';
import {
  getBurnableStatus,
  getMintableStatus,
  getPausableStatus,
  getPausedStatus,
  mrc20TransferTo,
  pauseToken,
} from './calls/token';

dotenv.config();

const user1Provider = Web3Provider.buildnet(await Account.fromEnv());

const user2Provider = Web3Provider.buildnet(
  await Account.fromEnv('PRIVATE_KEY_TWO'),
);

let tokenDeployerContract: SmartContract;

beforeAll(async () => {
  tokenDeployerContract = await deployTokenDeployer(user1Provider);
});

describe('Tests of create token', () => {
  test('Create a new token', async () => {
    // get all the tokens
    const tokens = await getAllTokensAddresses(tokenDeployerContract);

    expect(tokens.length).toBe(0);

    const tokenName = 'MyToken';
    const tokenSymbol = 'MTK';
    const decimals = 18;
    const totalSupply = 10000000;
    const url = `https://www.mytoken.com`;

    const description =
      '(TKN) is the native utility and governance token of [Your DEX Name], a decentralized exchange (DEX) built on the Massa Blockchain. Designed for scalability and decentralization, our token powers a seamless and efficient trading experience while fostering community-driven decision-making.';

    await createNewToken(
      tokenDeployerContract,
      tokenName,
      tokenSymbol,
      decimals,
      totalSupply,
      url,
      description,
      3,
    );

    // get all the tokens
    const tokensAfter = await getAllTokensAddresses(tokenDeployerContract);

    console.log('Tokens:', tokensAfter);

    expect(tokensAfter.length).toBe(1);

    const tokenContract = new MRC20(user1Provider, tokensAfter[0]);

    // get token pausable status
    const pausableStatus = await getPausableStatus(tokenContract);

    expect(pausableStatus).toBe(false);

    // Get token mintable status
    const mintableStatus = await getMintableStatus(tokenContract);

    expect(mintableStatus).toBe(false);

    // Get token burnable status
    const burnableStatus = await getBurnableStatus(tokenContract);

    expect(burnableStatus).toBe(false);
  });
});

describe('Test pausable, mintable, burnable tokens', () => {
  let tokenAddress: string;
  let tokenContract: MRC20;

  test('create a new pausable, mintable, burnable token', async () => {
    const tokenName = 'MyToken';
    const tokenSymbol = 'MTK';
    const decimals = 18;
    const totalSupply = 10000000;
    const url = `https://www.mytoken.com`;
    const description = 'tet ';
    const coinsToUseOnDeploy = 3;
    const pausable = true;
    const mintable = true;
    const burnable = true;

    await createNewToken(
      tokenDeployerContract,
      tokenName,
      tokenSymbol,
      decimals,
      totalSupply,
      url,
      description,
      coinsToUseOnDeploy,
      pausable,
      mintable,
      burnable,
    );

    // get all the tokens
    const tokensAfter = await getAllTokensAddresses(tokenDeployerContract);

    // expect(tokensAfter.length).toBe(2);

    tokenAddress = tokensAfter[tokensAfter.length - 1];
    tokenContract = new MRC20(user1Provider, tokenAddress);

    // get token pausable status
    const pausableStatus = await getPausableStatus(tokenContract);

    expect(pausableStatus).toBe(true);

    // Get token mintable status
    const mintableStatus = await getMintableStatus(tokenContract);

    expect(mintableStatus).toBe(true);

    // Get token burnable status
    const burnableStatus = await getBurnableStatus(tokenContract);

    expect(burnableStatus).toBe(true);
  });

  test('paused status should be true after pause', async () => {
    expect(await getPausedStatus(tokenContract)).toBe(false);

    await pauseToken(tokenContract);

    // get token paused status
    const pausedStatus = await getPausedStatus(tokenContract);

    expect(pausedStatus).toBe(true);
  });

  test('should not allow trasnfer after pause', async () => {
    const amount = 1;
    const receiverAddress = user2Provider.address;

    await expect(
      mrc20TransferTo(tokenContract, receiverAddress, amount),
    ).rejects.toThrow(
      'readonly call failed: VM Error in ReadOnlyExecutionTarget::FunctionCall context: VM execution error: RuntimeError: Runtime error: error: TOKEN_PAUSED at assembly/contracts/token.ts:185 col: 5',
    );
  });
});
