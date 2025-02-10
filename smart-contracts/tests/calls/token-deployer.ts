import {
  Args,
  ArrayTypes,
  bytesToArray,
  bytesToStr,
  Mas,
  OperationStatus,
  parseMas,
  parseUnits,
  Provider,
  SmartContract,
} from '@massalabs/massa-web3';
import { getScByteCode } from '../utils';

export async function deployTokenDeployer(provider: Provider) {
  console.log('Deploying TokenDeployer contract...');

  const byteCode = getScByteCode('build', 'tokenDeployer.wasm');

  // Constructr empty args
  const constructorArgs = new Args().serialize();

  let contract = await SmartContract.deploy(
    provider,
    byteCode,
    constructorArgs,
    {
      coins: Mas.fromString('0.9'),
    },
  );

  console.log('Contract deployed at:', contract.address);

  return contract;
}

export async function createNewToken(
  tokenDeployerContract: SmartContract,
  tokenName: string,
  tokenSymbol: string,
  decimals: number,
  totalSupply: number,
  url: string = '',
  description: string = '',
  coinsToUseOnDeploy: number = 0,
  pausable: boolean = false,
  mintable: boolean = false,
  burnable: boolean = false,
) {
  console.log('Creating new token...');

  const args = new Args()
    .addString(tokenName)
    .addString(tokenSymbol)
    .addU8(BigInt(decimals))
    .addU256(parseUnits(totalSupply.toString(), decimals))
    .addString(url)
    .addString(description)
    .addBool(pausable)
    .addBool(mintable)
    .addBool(burnable);

  if (coinsToUseOnDeploy > 0) {
    args.addU64(parseMas(coinsToUseOnDeploy.toString()));
  }

  const operation = await tokenDeployerContract.call(
    'createNewToken',
    args.serialize(),
    {
      coins: Mas.fromString('6'),
    },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Token created successfully');
  } else {
    console.log('Token creation failed');

    console.log('Error events: ', await operation.getSpeculativeEvents());

    throw new Error('Token creation failed');
  }
}

export async function getAllTokensAddresses(
  tokenDeployerContract: SmartContract,
) {
  console.log('Getting all tokens...');

  const result = await tokenDeployerContract.read('getTokens');

  const tokens: string[] = new Args(result.value).nextArray(ArrayTypes.STRING);

  console.log('Tokens:', tokens);

  return tokens;
}
