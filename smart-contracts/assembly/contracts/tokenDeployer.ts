import { Args, stringToBytes } from '@massalabs/as-types';
import {
  createSC,
  fileToByteArray,
  generateEvent,
  generateRawEvent,
  Storage,
} from '@massalabs/massa-as-sdk';
import { IMRC20 } from '../interfaces/IMRC20';
import { deserializeStringArray, serializeStringArray } from '../utils';

// array of all tokens addresses deployed
export const tokenAddresses: StaticArray<u8> = stringToBytes('tokensAddresses');

/**
 * Constructor for the token deployer contract.
 * @returns void
 */
export function constructor(_: StaticArray<u8>): void {
  Storage.set(tokenAddresses, serializeStringArray([]));
  generateEvent(`Token Deployer deployed.`);
}

/**
 * Create a new token and deploy it on the blockchain.
 * @param binaryArgs - The binary arguments for creating the token.(tokenName, tokenSymbol, decimals, totalSupply, url, description)
 * @returns void
 */
export function createNewToken(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const tokenName = args.nextString().expect('Invalid token name');
  const tokenSymbol = args.nextString().expect('Invalid token symbol');
  const decimals = args.nextU8().expect('Invalid decimals');
  const totalSupply = args.nextU256().expect('Invalid total supply');
  // optional parameter
  const url = args.nextString().unwrapOrDefault();
  // optional parameter
  const description = args.nextString().unwrapOrDefault();
  // optional parameter that specifies the coins to use on deploy the new token. Default value is 0.005 * 10 ** 6
  const coinsToUseOnDeployIn = args.nextU64();
  let coinsToUseOnDeploy: u64;

  if (coinsToUseOnDeployIn.isErr()) {
    // default value
    coinsToUseOnDeploy = u64(5 * 10 ** 7);
  } else {
    coinsToUseOnDeploy = coinsToUseOnDeployIn.unwrap();
  }

  // get the token bytecode
  const tokenByteCode: StaticArray<u8> = fileToByteArray('build/token.wasm');

  // deploy the token contract
  const tokenAddress = createSC(tokenByteCode);

  // init the token contract
  new IMRC20(tokenAddress).initExtended(
    tokenName,
    tokenSymbol,
    decimals,
    totalSupply,
    url,
    description,
    coinsToUseOnDeploy,
  );

  // get the tokens array stored in storage
  const tokensStored = Storage.get(tokenAddresses);

  // deserialize the tokens array to string array
  const deserializedTokens = deserializeStringArray(tokensStored);

  // add the token address to the array of tokens
  deserializedTokens.push(tokenAddress.toString());

  // serialize the array of tokens
  Storage.set(tokenAddresses, serializeStringArray(deserializedTokens));

  // emit an event
  generateEvent(`New Token ${tokenName} deployed at ${tokenAddress}.`);

  // raw event to be able to get the token address at the frotnend by using operation.getDeployedAddress(true)
  generateRawEvent(new Args().add(tokenAddress).serialize());
}

/**
 * Retrieves all tokens deployed on the blockchain.
 * @returns The array of tokens.
 */
export function getTokens(): StaticArray<u8> {
  return Storage.get(tokenAddresses);
}
