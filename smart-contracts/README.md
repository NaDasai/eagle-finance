# Eagle Finance - Decentralized Exchange Protocol

## Introduction

**Eagle Finance** is a decentralized exchange (DEX) protocol designed for the Massa blockchain. It facilitates automated liquidity provision and token swapping through a suite of smart contracts written in AssemblyScript. This protocol aims to provide efficient, secure, and flexible trading capabilities for MRC-20 tokens, including wrapped native MAS (WMAS).

**Key Components:**

*   **Basic Pool:** The core smart contract for liquidity pools, enabling users to add liquidity, swap tokens, and manage their LP positions.
*   **Registry:** A smart contract that acts as a factory and manager for deploying and tracking various liquidity pools.
*   **MRC-20 Token:** A standard token contract based on Massa's MRC-20 specification, enhanced with metadata functionalities like URL and description.
*   **Token Deployer:** A smart contract that allows for the deployment of new MRC-20 tokens.
*   **Flash Swap:** A functionality that allows users to borrow tokens without upfront collateral, provided they are returned within the same transaction.
*   **TWAP Oracle:** A mechanism that tracks cumulative prices to enable Time-Weighted Average Price (TWAP) calculations.

**Important Note:** While Eagle Finance primarily supports MRC-20 tokens, it also includes logic to handle native MAS coins when wrapped into WMAS. Direct swaps with native MAS are supported through the wrapping/unwrapping mechanism.

## Project Structure

The project is organized as follows:

*   `contracts/`: Contains all smart contract source code and related libraries.
    *   `basicPool.ts`: Implements the core logic for a liquidity pool, including swapping, liquidity management, and flash swaps.
    *   `registry.ts`: Manages the deployment of pools, protocol fees, and the WMAS token address.
    *   `token.ts`: Implements an MRC-20 token with additional metadata (URL, description).
    *   `tokenDeployer.ts`: Provides a contract to deploy new MRC-20 tokens.
    *   `lib/`: Contains core libraries and logic for the contracts
        *   `basicPoolMath.ts`: Implements mathematical functions for calculating swaps, fees, and liquidity in the basic pool.
        *   `liquidityManager.ts`: Manages liquidity and LP token balances within the contracts.
        *   `math.ts`: Provides mathematical utility functions for the contracts, including decimal normalization and fee validation.
        *   `safeMath.ts`: Implements safe mathematical operations for preventing overflows and underflows, including square root calculation.
    *   `interfaces/`: Provides the interfaces for all smart contracts.
        *   `IBasicPool.ts`: Defines the interface for the basic pool contract.
        *   `IMRC20.ts`: Defines the interface for the MRC-20 token contract.
        *   `IRegistry.ts`: Defines the interface for the registry contract.
        *   `IEagleCallee.ts`: Defines the interface for the callback function used in flash swaps.
    *   `structs/`: Contains data structures
        *   `pool.ts`: Defines the structure of a pool object.
    *   `utils/`: Contains utility functions for the contracts
        *   `index.ts`: Exports all the utility files in this folder.
        *   `ownership-internal.ts`: Implements internal functions for ownership management.
        *   `ownership.ts`: Implements external functions for ownership management.
        *   `constants.ts`: Defines constants used in the contracts.
*   `build/`: Contains compiled WASM files.
    *   `basicPool.wasm`: The compiled WASM for the Basic Pool contract.
    *   `registry.wasm`: The compiled WASM for the Registry contract.
    *   `token.wasm`: The compiled WASM for the MRC-20 token contract.
    *   `tokenDeployer.wasm`: The compiled WASM for the token deployer contract.

## Smart Contracts Overview

### 1. Basic Pool (`basicPool.ts`)

This contract is the heart of the DEX, implementing a liquidity pool for trading two MRC-20 tokens. It allows users to:

*   **Add Liquidity:** Deposit tokens A and B into the pool, receiving LP tokens in return.
*   **Remove Liquidity:** Burn LP tokens to withdraw tokens A and B.
*   **Swap:** Exchange tokens A for B or vice-versa based on the current pool reserves and a defined fee.
*   **Swap With MAS:** Swap with native MAS tokens by wrapping them into WMAS.
*   **Claim Protocol Fees:** Collect accumulated fees that are reserved for the protocol.
*   **Get Swap Estimation:** Estimate the output amount for a given swap input.
*   **Synchronize Reserves:** Update the pool's reserves to match the actual token balances. Only the registry owner can call this function.
*   **Get LP Balance:** Retrieve the LP token balance of a user.
*   **Get Local Reserve A/B:** Get the current reserves of token A and token B.
*   **Get TWAP:** Calculate the Time-Weighted Average Price (TWAP) for a given token over a specified duration.
*   **Flash Swap:** Borrow tokens from the pool without upfront collateral, provided they are returned within the same transaction.

**Key Features:**

*   **MRC-20 and WMAS Support:** Designed to work with MRC-20 tokens and wrapped MAS (WMAS).
*   **Fee Structure:** Implements a swap fee that is split between liquidity providers and the protocol.
*   **Dynamic Reserves:** Reserves are automatically updated after each transaction.
*   **Initial Liquidity:** Calculates initial liquidity using the square root of the product of initial token deposits.
*   **Proportional Liquidity:** Adds liquidity proportionally based on existing reserves.
*   **LP Token Management:** Uses the `LiquidityManager` library for minting and burning LP tokens.
*   **Protocol Fee Receiver:** Protocol fees can be claimed by the protocol fee receiver defined in the registry.
*   **Flash Swap Functionality:** Allows for flash loans, enabling advanced trading strategies.
*   **TWAP Oracle:** Tracks cumulative prices for TWAP calculations.

**Constructor Arguments:**

*   `aAddress` (string): The address of token A.
*   `bAddress` (string): The address of token B.
*   `feeRate` (f64): The trading fee rate, between 0 and 1.
*   `feeShareProtocol` (f64): The protocol's share of the trading fee, between 0 and 1.
*   `registryAddress` (string): The address of the registry contract.

**Public Functions:**

*   `constructor(binaryArgs: StaticArray<u8>): void`: Constructor for the pool.
*   `addLiquidity(binaryArgs: StaticArray<u8>): void`: Adds liquidity to the pool.
*   `addLiquidityWithMas(binaryArgs: StaticArray<u8>): void`: Adds liquidity to the pool with native MAS token.
*   `addLiquidityFromRegistry(binaryArgs: StaticArray<u8>): void`: Adds liquidity to the pool from the registry contract.
*   `swap(binaryArgs: StaticArray<u8>): void`: Swaps tokens in the pool.
*   `swapWithMas(binaryArgs: StaticArray<u8>): void`: Swaps tokens with native MAS token when it is wrapped to WMAS.
*   `claimProtocolFees(): void`: Claims accumulated protocol fees.
*   `removeLiquidity(binaryArgs: StaticArray<u8>): void`: Removes liquidity from the pool.
*   `getSwapOutEstimation(binaryArgs: StaticArray<u8>): StaticArray<u8>`: Retrieves the swap estimation for a given input amount.
*   `syncReserves(): void`: Synchronizes the reserves of the pool with the current balances of the tokens.
*   `getLPBalance(binaryArgs: StaticArray<u8>): StaticArray<u8>`: Retrieves the balance of the LP token for a given user.
*   `getLocalReserveA(): StaticArray<u8>`: Retrieves the local reserve of token A.
*   `getLocalReserveB(): StaticArray<u8>`: Retrieves the local reserve of token B.
*   `getAPriceCumulativeLast(): StaticArray<u8>`: Retrieves the last recorded cumulative price of token A.
*   `getBPriceCumulativeLast(): StaticArray<u8>`: Retrieves the last recorded cumulative price of token B.
*   `getTWAP(tokenInAddress: string, duration: u64): StaticArray<u8>`: Calculates the Time-Weighted Average Price (TWAP) for a given token.
*   `flashSwap(binaryArgs: StaticArray<u8>): void`: Executes a flash swap.

### 2. Registry (`registry.ts`)

The registry contract manages the deployment and configuration of liquidity pools. It provides functionalities to:

*   **Create New Pool:** Deploy a new basic pool with specified tokens and fee rates.
*   **Create New Pool With Initial Liquidity:** Deploy a new basic pool with specified tokens, fee rates, and initial liquidity.
*   **Get Pools:** Retrieve an array containing all registered pools.
*   **Set Protocol Fee Receiver:** Sets the receiver of the protocol fees.
*   **Get Protocol Fee Receiver:** Gets the receiver of the protocol fees.
*   **Set WMAS Token Address:** Sets the address of the WMAS token.
*   **Get WMAS Token Address:** Gets the address of the WMAS token.
*   **Get Protocol Fee Share:** Returns the protocol fee share.
*   **Ownership:** Only the owner of the contract can set the protocol fee receiver and the WMAS token address.

**Key Features:**

*   **Pool Management:** Manages the creation and storage of liquidity pool contracts.
*   **Fee Configuration:** Sets the default protocol fee share for all pools.
*   **Security:** Only the owner of the contract can perform sensitive actions.
*   **WMAS Address Management:** Stores and manages the address of the wrapped MAS token.

**Constructor Arguments:**

*   `feeShareProtocol` (f64): The protocol's default share of the trading fee, between 0 and 1.
*   `wmasTokenAddress` (string): The address of the wrapped MAS token.

**Public Functions:**

*   `constructor(binaryArgs: StaticArray<u8>): void`: Constructor for the registry.
*   `createNewPool(binaryArgs: StaticArray<u8>): void`: Adds a new pool to the registry.
*   `createNewPoolWithLiquidity(binaryArgs: StaticArray<u8>): void`: Creates a new pool with initial liquidity.
*   `getPools(): StaticArray<u8>`: Retrieves all pools in the registry.
*   `getFeeShareProtocol(): StaticArray<u8>`: Get the fee share protocol.
*   `getFeeShareProtocolReceiver(): StaticArray<u8>`: Get the fee share protocol receiver.
*   `setFeeShareProtocolReceiver(binaryArgs: StaticArray<u8>): void`: Set the fee share protocol receiver.
*   `getWmasTokenAddress(): StaticArray<u8>`: Get the WMAS token address.
*   `setWmasTokenAddress(binaryArgs: StaticArray<u8>): void`: Set the WMAS token address.
*   Other Ownership functions.

### 3. MRC-20 Token (`token.ts`)

This contract implements a standard MRC-20 token, providing functionalities to:

*   **Basic Token Functions:** It provides the basic MRC-20 token functionalities (mint, burn, transfer, allowance, etc.).
*   **Token Metadata:** It provides functions to get the token URL and description.

**Key Features:**

*   **MRC-20 Compliant:** Implements the standard MRC-20 token interface.
*   **Metadata:** It contains functions to get the token URL and description.

**Constructor Arguments:**

*   `admin` (string): The address that will be the owner of the token.
*   `tokenName` (string): The name of the token.
*   `tokenSymbol` (string): The symbol of the token.
*   `decimals` (u8): The number of decimals the token uses.
*   `totalSupply` (u256): The total supply of the token.
*   `url` (string) (optional): The URL of the token.
*   `description` (string) (optional): The description of the token.

**Public Functions:**

*   `constructor(binaryArgs: StaticArray<u8>): void`: Constructor for the MRC-20 token.
*   `url(_: StaticArray<u8>): StaticArray<u8>`: Returns the token URL.
*   `description(_: StaticArray<u8>): StaticArray<u8>`: Returns the token description.
*   Other default MRC-20 functions like `transfer`, `approve`, `allowance`, `balanceOf`.

### 4. Token Deployer (`tokenDeployer.ts`)

This contract allows deploying new MRC-20 tokens on the blockchain. It provides functionalities to:

*   **Deploy New MRC-20 Token:** Deploys a new MRC-20 token with the provided parameters.
*   **Get Deployed Tokens:** Get all the tokens deployed by this contract.

**Key Features:**

*   **Token Deployment:** Allows deploying new MRC-20 tokens by anyone.

**Public Functions:**

*   `constructor(_: StaticArray<u8>): void`: Constructor for the token deployer contract.
*   `createNewToken(binaryArgs: StaticArray<u8>): void`: Deploys a new MRC-20 token.
*   `getTokens(): StaticArray<u8>`: Get all the tokens deployed by this contract.

## Libraries

### Basic Pool Math (`lib/basicPoolMath.ts`)

This library provides essential math functions for calculating swaps, fees, and liquidity within the Basic Pool contract. It includes functions for:

*   **`getFeeFromAmount(inputAmount: u256, feeRate: f64): u256`**: Calculates the fee amount based on the input amount and fee rate.
*   **`getAmountOut(inputAmount: u256, inputReserve: u256, outputReserve: u256): u256`**: Calculates the output amount based on the input amount and reserves.

### Liquidity Manager (`lib/liquidityManager.ts`)

This library manages the liquidity and LP token balances within the contracts. It handles:

*   **Minting:** Creation of new LP tokens.
*   **Burning:** Destruction of LP tokens.
*   **Balance Tracking:** Tracks the LP token balances of users.

### Math (`lib/math.ts`)

This library contains mathematical utility functions:

*   **`f64ToU256(value: f64, decimals: i32): u256`**: Converts a `float64` to a `u256` with a specified number of decimals.
*   **`normalizeToDecimals(value: u256, currentDecimals: i32, toDecimals: i32): u256`**: Normalizes a number to a specific number of decimals.
*   **`isBetweenZeroAndTenPercent(value: f64): bool`**: Checks if a `float64` value is between 0 and 10 percent.

### Safe Math (`lib/safeMath.ts`)

This library ensures safe mathematical operations, preventing overflows and underflows:

*   **`add(a: u256, b: u256): u256`**: Safe addition of two `u256` numbers.
*   **`sub(a: u256, b: u256): u256`**: Safe subtraction of two `u256` numbers.
*   **`mul(a: u256, b: u256): u256`**: Safe multiplication of two `u256` numbers.
*   **`div(a: u256, b: u256): u256`**: Safe division of two `u256` numbers.
*   **`mod(a: u256, b: u256): u256`**: Safe modulo operation of two `u256` numbers.
*   **`sqrt(a: u256): u256`**: Calculate the square root of a `u256` number.

## Getting Started

To start using or contributing to the project:

1.  **Clone the Repository:** Clone this repository to your local machine.
2.  **Install dependencies:** Run `npm install` in the root folder.
3.  **Compile the Contracts:** Compile the contracts using `npm run build`.
4.  **Add your private key to the `.env` file:** Take a look at the `.env.example` file and add your private key to the `.env` file.
5.  **Deploy:** Deploy the WASM contracts to the Massa blockchain using `npm run deploy`.
6.  **Interact:** Use Massa's SDK to interact with the deployed contracts.

## Disclaimer

This is a work in progress. Use at your own risk. The code may contain bugs. Always test on buildnet before deploying to mainnet.
