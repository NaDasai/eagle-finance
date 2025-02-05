import { Account, SmartContract, Web3Provider } from '@massalabs/massa-web3';
import { beforeAll, describe, expect, test } from 'vitest';
import {
  createNewToken,
  deployTokenDeployer,
  getAllTokensAddresses,
} from './calls/token-deployer';
import * as dotenv from 'dotenv';

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
      2,
    );

    // get all the tokens
    const tokensAfter = await getAllTokensAddresses(tokenDeployerContract);

    console.log('Tokens:', tokensAfter);

    expect(tokensAfter.length).toBe(1);
  });
});
