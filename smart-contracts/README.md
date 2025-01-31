# Eagle Finance - Decentralized Exchange Protocol

## Introduction

**Eagle Finance** is a robust and flexible decentralized exchange (DEX) protocol built for the Massa blockchain. It provides a comprehensive suite of smart contracts, written in AssemblyScript, that enable automated liquidity provision, token swapping, and advanced trading functionalities. The protocol is designed to be efficient, secure, and adaptable, supporting both MRC-20 tokens and wrapped native MAS (WMAS).

**Key Features:**

*   **Automated Liquidity Pools:** Facilitates the creation and management of liquidity pools for seamless token trading.
*   **MRC-20 and WMAS Compatibility:** Supports trading of any MRC-20 token, including wrapped native MAS (WMAS).
*   **Efficient Token Swapping:** Enables quick and cost-effective token swaps based on the constant product formula (x\*y=k).
*   **Flash Loans:** Allows users to borrow tokens without upfront collateral, provided they are returned within the same transaction, enabling arbitrage opportunities.
*   **Protocol Fee Management:** Allows for the collection and distribution of protocol fees to stakeholders.
*   **Secure and Auditable:** Built with security best practices and designed for easy auditing.

## Project Structure

The project is structured to promote clarity and maintainability:

*   `contracts/`: Contains all smart contract source code and related libraries.
    *   `basicPool.ts`: Implements the core logic for a liquidity pool, including swapping, liquidity management, flash loans, and last comulative prices calculations.
    *   `registry.ts`: Manages the deployment of pools. Acts as a factory for creating new pools.
    *   `token.ts`: Implements an MRC-20 token with additional metadata (URL, description), adhering to the MRC-20 standard.
    *   `tokenDeployer.ts`: Provides a contract to deploy new MRC-20 tokens, simplifying token creation.
    *   `lib/`: Contains core libraries and logic for the contracts.
        *   `basicPoolMath.ts`: Implements mathematical functions for calculating swaps, fees, and liquidity in the basic pool.
        *   `liquidityManager.ts`: Manages liquidity and LP token balances within the contracts.
        *   `math.ts`: Provides mathematical utility functions for the contracts, including decimal normalization and fee validation.
        *   `safeMath.ts`: Implements safe mathematical operations for preventing overflows and underflows, including square root calculation.
        *   `ReentrancyGuard.ts`: Implements a reentrancy guard to protect against reentrant calls.
    *   `interfaces/`: Provides the interfaces for all smart contracts.
        *   `IBasicPool.ts`: Defines the interface for the basic pool contract.
        *   `IMRC20.ts`: Defines the interface for the MRC-20 token contract.
        *   `IRegistry.ts`: Defines the interface for the registry contract.
        *   `IEagleCallee.ts`: Defines the interface for the callback function used in Flash Loans.
    *   `structs/`: Contains data structures.
        *   `pool.ts`: Defines the structure of a pool object.
        *   `userToken.ts`: Defines the structure of a user token object.
    *   `utils/`: Contains utility functions for the contracts.
        *   `index.ts`: Exports all the utility files in this folder.
        *   `ownership-internal.ts`: Implements internal functions for ownership management.
        *   `ownership.ts`: Implements external functions for ownership management.
        *   `constants.ts`: Defines constants used in the contracts.
## Smart Contracts Overview

### 1. Basic Pool (`basicPool.ts`)

The `basicPool.ts` contract is the core of the Eagle Finance DEX, implementing a liquidity pool for trading two MRC-20 tokens. It enables users to:

*   **Add Liquidity:** Deposit tokens A and B into the pool, receiving LP tokens in return.
*   **Remove Liquidity:** Burn LP tokens to withdraw tokens A and B.
*   **Swap Tokens:** Exchange tokens A for B or vice-versa based on the current pool reserves and a defined fee.
*   **Swap With MAS:** Swap with native MAS tokens by wrapping them into WMAS.
*   **Claim Protocol Fees:** Collect accumulated fees that are reserved for the protocol.
*   **Estimate Swap Output:** Calculate the expected output amount for a given swap input.
*   **Synchronize Reserves:** Update the pool's reserves to match the actual token balances. (Only callable by the registry owner)
*   **Get LP Balance:** Retrieve the LP token balance of a user.
*   **Get Local Reserves:** Get the current reserves of token A and token B.
*   **Flash Loan:** Borrow tokens from the pool without upfront collateral, provided they are returned within the same transaction.

**Key Features:**

*   **MRC-20 and WMAS Support:** Designed to work with MRC-20 tokens and wrapped MAS (WMAS).
*   **Fee Structure:** Implements a swap fee that is split between liquidity providers and the protocol.
*   **Dynamic Reserves:** Reserves are automatically updated after each transaction.
*   **Initial Liquidity:** Calculates initial liquidity using the square root of the product of initial token deposits.
*   **Proportional Liquidity:** Adds liquidity proportionally based on existing reserves.
*   **LP Token Management:** Uses the `LiquidityManager` library for minting and burning LP tokens.
*   **Protocol Fee Receiver:** Protocol fees can be claimed by the protocol fee receiver defined in the registry.
*   **Flash Loan Functionality:** Allows for flash loans, enabling advanced trading strategies.
*   **Reentrancy Guard:** Implements a reentrancy guard to prevent reentrant calls.

**Constructor Arguments:**

*   `aAddress` (`string`): The address of token A.
*   `bAddress` (`string`): The address of token B.
*   `feeRate` (`f64`): The trading fee rate, between 0 and 1.
*   `feeShareProtocol` (`f64`): The protocol's share of the trading fee, between 0 and 1.
*   `registryAddress` (`string`): The address of the registry contract.

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
*   `getLastTimestamp(): StaticArray<u8>`: Retrieves the last recorded timestamp.
*   `getSwapInEstimation(binaryArgs: StaticArray<u8>): StaticArray<u8>`: Retrieves the swap in estimation for a given output amount.
*   `flash(binaryArgs: StaticArray<u8>): void`: Executes a Flash Loan.

### 2. Registry (`registry.ts`)

The `registry.ts` contract manages the deployment and configuration of liquidity pools. It provides functionalities to:

*   **Create New Pool:** Deploy a new basic pool with specified tokens and fee rates.
*   **Create New Pool With Initial Liquidity:** Deploy a new basic pool with specified tokens, fee rates, and initial liquidity.
*   **Get Pools:** Retrieve an array containing all registered pools.
*   **Set Protocol Fee Receiver:** Sets the receiver of the protocol fees.
*   **Get Protocol Fee Receiver:** Gets the receiver of the protocol fees.
*   **Set WMAS Token Address:** Sets the address of the WMAS token.
*   **Get WMAS Token Address:** Gets the address of the WMAS token.
*   **Get Protocol Fee Share:** Returns the protocol fee share.
*   **Ownership:** Only the owner of the contract can set the protocol fee receiver and the WMAS token address.
*   **Pool Existence Check:** Checks if a pool with the given token addresses and input fee rate exists in the registry.

**Key Features:**

*   **Pool Management:** Manages the creation and storage of liquidity pool contracts.
*   **Fee Configuration:** Sets the default protocol fee share for all pools.
*   **Security:** Only the owner of the contract can perform sensitive actions.
*   **WMAS Address Management:** Stores and manages the address of the wrapped MAS token.
*   **Reentrancy Guard:** Implements a reentrancy guard to prevent reentrant calls.

**Constructor Arguments:**

*   `feeShareProtocol` (`f64`): The protocol's default share of the trading fee, between 0 and 1.
*   `wmasTokenAddress` (`string`): The address of the wrapped MAS token.

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
*   `isPoolExists(binaryArgs: StaticArray<u8>): StaticArray<u8>`: Checks if a pool with the given token addresses and input fee rate exists in the registry.
*   Other Ownership functions.

### 3. MRC-20 Token (`token.ts`)

The `token.ts` contract implements a standard MRC-20 token, providing functionalities to:

*   **Basic Token Functions:** It provides the basic MRC-20 token functionalities (mint, burn, transfer, allowance, etc.).
*   **Token Metadata:** It provides functions to get the token URL and description.

**Key Features:**

*   **MRC-20 Compliant:** Implements the standard MRC-20 token interface.
*   **Metadata:** It contains functions to get the token URL and description.

**Constructor Arguments:**

*   `admin` (`string`): The address that will be the owner of the token.
*   `tokenName` (`string`): The name of the token.
*   `tokenSymbol` (`string`): The symbol of the token.
*   `decimals` (`u8`): The number of decimals the token uses.
*   `totalSupply` (`u256`): The total supply of the token.
*   `url` (`string`) (optional): The URL of the token.
*   `description` (`string`) (optional): The description of the token.

**Public Functions:**

*   `constructor(binaryArgs: StaticArray<u8>): void`: Constructor for the MRC-20 token.
*   `url(_: StaticArray<u8>): StaticArray<u8>`: Returns the token URL.
*   `description(_: StaticArray<u8>): StaticArray<u8>`: Returns the token description.
*   Other default MRC-20 functions like `transfer`, `approve`, `allowance`, `balanceOf`.

### 4. Token Deployer (`tokenDeployer.ts`)

The `tokenDeployer.ts` contract allows deploying new MRC-20 tokens on the blockchain. It provides functionalities to:

*   **Deploy New MRC-20 Token:** Deploys a new MRC-20 token with the provided parameters.
*   **Get Deployed Tokens:** Get all the tokens deployed by this contract.
*   **Get User Token Balances:** Get the balances of a user for all the tokens deployed by this contract.

**Key Features:**

*   **Token Deployment:** Allows deploying new MRC-20 tokens by anyone.
*   **User Balances:** Allows retrieving the balances of a user for all the tokens deployed by this contract.

**Public Functions:**

*   `constructor(_: StaticArray<u8>): void`: Constructor for the token deployer contract.
*   `createNewToken(binaryArgs: StaticArray<u8>): void`: Deploys a new MRC-20 token.
*   `getTokens(): StaticArray<u8>`: Get all the tokens deployed by this contract.
*   `getUserTokenBalances(binaryArgs: StaticArray<u8>): StaticArray<u8>`: Get the balances of a user for all the tokens deployed by this contract.

## Libraries

### Basic Pool Math (`lib/basicPoolMath.ts`)

This library provides essential math functions for calculating swaps, fees, and liquidity within the Basic Pool contract. It includes functions for:

*   **`getFeeFromAmount(inputAmount: u256, feeRate: f64): u256`**: Calculates the fee amount based on the input amount and fee rate.
*   **`getAmountOut(inputAmount: u256, inputReserve: u256, outputReserve: u256): u256`**: Calculates the output amount based on the input amount and reserves.
*   **`getAmountIn(amountOut: u256, reserveIn: u256, reserveOut: u256): u256`**: Calculates the input amount based on the output amount and reserves.
*   **`getAmountWithoutFee(totalAmount: u256, feeRate: f64): u256`**: Calculates the amount without fee based on the total amount and fee rate.

### Liquidity Manager (`lib/liquidityManager.ts`)

This library manages the liquidity and LP token balances within the contracts. It handles:

*   **Minting:** Creation of new LP tokens.
*   **Burning:** Destruction of LP tokens.
*   **Balance Tracking:** Tracks the LP token balances of users.

### Math (`lib/math.ts`)

This library contains mathematical utility functions:

*   **`isBetweenZeroAndTenPercent(value: f64): bool`**: Checks if a `float64` value is between 0 and 10 percent.

### Safe Math (`lib/safeMath.ts`)

This library ensures safe mathematical operations, preventing overflows and underflows:

*   **`add(a: u256, b: u256): u256`**: Safe addition of two `u256` numbers.
*   **`sub(a: u256, b: u256): u256`**: Safe subtraction of two `u256` numbers.
*   **`mul(a: u256, b: u256): u256`**: Safe multiplication of two `u256` numbers.
*   **`div(a: u256, b: u256): u256`**: Safe division of two `u256` numbers.
*   **`mod(a: u256, b: u256): u256`**: Safe modulo operation of two `u256` numbers.
*   **`sqrt(a: u256): u256`**: Calculate the square root of a `u256` number.

### Reentrancy Guard (`lib/ReentrancyGuard.ts`)

This library implements a reentrancy guard to prevent reentrant calls to a function.

*   **`nonReentrant(): void`**: Prevents a contract from calling itself, directly or indirectly.
*   **`endNonReentrant(): void`**: Ends the nonReentrant call.

## Getting Started

To start using or contributing to the project:

1.  **Clone the Repository:** Clone this repository to your local machine.
    ```bash
    git clone https://github.com/NaDasai/eagle-finance.git
    cd eagle-finance
    ```
2.  **Install dependencies:** Install all project dependencies.
    ```bash
    npm install
    ```
3.  **Compile the Contracts:** Compile the contracts using the `build` script.
    ```bash
    npm run build
    ```
4.  **Add your private key to the `.env` file:** Create a `.env` file in the root directory and add your private key, following the `.env.example` format.

5.  **Deploy:** Deploy the WASM contracts to the Massa blockchain using the deploy scripts.
    ```bash
    npm run deploy:registry
    npm run deploy:tokenDeployer
    npm run deploy:token
    ```
6.  **Interact:** Use Massa's SDK or a web3 library to interact with the deployed contracts.

## Testing

The project includes unit tests using `vitest` located on `tests` and `src/builnet-tests`.To run the tests:

```bash
npm run test
```

For a more detailed test output:

```bash
npm run test:verbose
```

To run the tests with UI:

```bash
npm run test:ui
```

## Disclaimer

This is a work in progress. Use at your own risk. The code may contain bugs. Always test on buildnet before deploying to mainnet.