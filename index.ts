/*
 * Create, claim and verify a Payment Channel.
 * Reference: https://xrpl.org/paychannel.html
 */
import {
  Client,
  Wallet,
} from "xrpl";
import fetch from "node-fetch";
import * as crypto from "crypto";

// Use a direct HTTP endpoint for raw JSON-RPC calls
const TESTNET_URL = "https://s.altnet.rippletest.net:51234";
const client = new Client("wss://s.altnet.rippletest.net:51233");

void claimPayChannel();

// Function to make raw JSON-RPC calls
async function sendJsonRpc(method: string, params: any): Promise<any> {
  const response = await fetch(TESTNET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method,
      params: [params],
    }),
  });

  return response.json();
}

// Function to sign and submit a transaction
async function signAndSubmit(tx: any, wallet: Wallet): Promise<any> {
  // Prepare transaction with auto-fillable fields
  const prepared = await client.autofill(tx);

  // Sign the transaction locally
  const signed = wallet.sign(prepared);

  // Submit the signed transaction blob
  return sendJsonRpc("submit", {
    tx_blob: signed.tx_blob,
  });
}

// Since we can't directly call the channel_authorize API,
// we'll use a wrapper to send the request through xrpl client instead
async function channelAuthorize(
  channelId: string,
  amount: string,
  seed: string
): Promise<any> {
  // Make a direct request to the server through the WebSocket connection
  const authorizeResult = await client.connection.request({
    command: "channel_authorize",
    channel_id: channelId,
    amount: amount,
    secret: seed,
  });

  return authorizeResult;
}

// The snippet walks us through creating and claiming a Payment Channel.
async function claimPayChannel(): Promise<void> {
  await client.connect();

  // creating wallets as prerequisite
  const { wallet: wallet1 } = await client.fundWallet();
  const { wallet: wallet2 } = await client.fundWallet();

  console.log("Balances of wallets before Payment Channel is claimed:");
  console.log(
    `Balance of ${wallet1.address} is ${await client.getXrpBalance(
      wallet1.address
    )} XRP`
  );
  console.log(
    `Balance of ${wallet2.address} is ${await client.getXrpBalance(
      wallet2.address
    )} XRP`
  );

  // create a Payment Channel using local signing
  console.log("Submitting a PaymentChannelCreate transaction...");
  const paymentChannelCreateTx = {
    TransactionType: "PaymentChannelCreate",
    Account: wallet1.classicAddress,
    Amount: "10000000",
    Destination: wallet2.classicAddress,
    SettleDelay: 86400,
    PublicKey: wallet1.publicKey,
  };

  const paymentChannelCreateResponse = await signAndSubmit(
    paymentChannelCreateTx,
    wallet1
  );
  console.log("PaymentChannelCreate transaction response:");
  console.log(paymentChannelCreateResponse);

  // Get transaction hash from the response
  const txHash = paymentChannelCreateResponse.result.tx_blob
    ? paymentChannelCreateResponse.result.tx_json.hash
    : paymentChannelCreateResponse.result.hash;

  // Wait for transaction to be validated and get details
  await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for ledger to close

  const txDetails = await sendJsonRpc("tx", {
    transaction: txHash,
  });
  console.log("Transaction details:", txDetails);

  // Find the Channel ID from the transaction metadata
  let channelId;
  if (txDetails.result.meta && txDetails.result.meta.AffectedNodes) {
    for (const node of txDetails.result.meta.AffectedNodes) {
      if (
        node.CreatedNode &&
        node.CreatedNode.LedgerEntryType === "PayChannel"
      ) {
        channelId = node.CreatedNode.LedgerIndex;
        break;
      }
    }
  }

  console.log("Channel ID:", channelId);

  // check that the object was actually created using account_objects
  const accountObjectsResponse = await sendJsonRpc("account_objects", {
    account: wallet1.classicAddress,
  });

  console.log(
    "Account Objects:",
    accountObjectsResponse.result.account_objects
  );

  // Define payment amount in XRP and convert to drops
  const paymentAmountXRP = 0.04;
  const paymentAmountDrops = (paymentAmountXRP * 1000000).toString(); // 40000 drops
  let cumulativeAmountDrops = 0;
  let finalSignature = "";

  console.log(
    `Making 100 off-chain payments of ${paymentAmountXRP} XRP (${paymentAmountDrops} drops) each`
  );

  // Loop to simulate 100 off-chain payments
  for (let i = 0; i < 100; i++) {
    // Increase cumulative amount
    cumulativeAmountDrops += parseInt(paymentAmountDrops);
    const currentClaimAmount = cumulativeAmountDrops.toString();

    // Create a claim for the current cumulative amount
    const authorizeResponse = await channelAuthorize(
      channelId,
      currentClaimAmount,
      wallet1.seed || ""
    );

    // Make sure we have a signature
    if (!authorizeResponse.result || !authorizeResponse.result.signature) {
      throw new Error(
        `Failed to get signature from channel_authorize for payment ${i + 1}`
      );
    }

    // Store the signature
    finalSignature = authorizeResponse.result.signature;

    // Verify every single claim
    const verifyResponse = await sendJsonRpc("channel_verify", {
      channel_id: channelId,
      signature: finalSignature,
      public_key: wallet1.publicKey,
      amount: currentClaimAmount,
    });

    console.log(
      `Payment ${i + 1}: Verified claim for ${currentClaimAmount} drops (${
        parseFloat(currentClaimAmount) / 1000000
      } XRP)`
    );
    console.log(
      `Verification result: ${
        verifyResponse.result.signature_verified ? "Valid ✓" : "Invalid ✗"
      }`
    );
  }

  console.log(
    `\nCompleted 100 off-chain payments totaling ${cumulativeAmountDrops} drops (${
      cumulativeAmountDrops / 1000000
    } XRP)`
  );
  console.log(`Final signature: ${finalSignature}`);

  // Now claim the total amount using the final signature
  const paymentChannelClaimTx = {
    Account: wallet2.classicAddress,
    TransactionType: "PaymentChannelClaim",
    Channel: channelId,
    Amount: cumulativeAmountDrops.toString(),
    Balance: cumulativeAmountDrops.toString(),
    Signature: finalSignature,
    PublicKey: wallet1.publicKey,
  };

  const channelClaimResponse = await signAndSubmit(
    paymentChannelClaimTx,
    wallet2
  );
  console.log("PaymentChannelClaim transaction response:");
  console.log(channelClaimResponse);

  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Check channel status after claim
  const channelsResponse = await sendJsonRpc("account_channels", {
    account: wallet1.classicAddress,
    destination_account: wallet2.classicAddress,
    ledger_index: "validated",
  });

  console.log("Channel status after claim:", channelsResponse);

  console.log("Balances of wallets after Payment Channel is claimed:");
  console.log(
    `Balance of ${wallet1.address} is ${await client.getXrpBalance(
      wallet1.address
    )} XRP`
  );
  console.log(
    `Balance of ${wallet2.address} is ${await client.getXrpBalance(
      wallet2.address
    )} XRP`
  );

  // Request to close the channel immediately (from the destination/payee account)
  const closeChannelTx = {
    Account: wallet2.classicAddress,
    TransactionType: "PaymentChannelClaim",
    Channel: channelId,
    Flags: 2147614720, // tfClose flag
  };

  const closeChannelResponse = await signAndSubmit(closeChannelTx, wallet2);
  console.log("Close channel response:", closeChannelResponse);

  // Wait a bit to allow ledger processing
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Check final balances after attempting to close the channel
  console.log("Final balances after channel close request:");
  console.log(
    `Final balance of ${
      wallet1.address
    } (payer) is ${await client.getXrpBalance(wallet1.address)} XRP`
  );
  console.log(
    `Final balance of ${
      wallet2.address
    } (payee) is ${await client.getXrpBalance(wallet2.address)} XRP`
  );

  // Check if channel still exists
  const finalChannelsResponse = await sendJsonRpc("account_channels", {
    account: wallet1.classicAddress,
    destination_account: wallet2.classicAddress,
    ledger_index: "validated",
  });

  console.log("Channel status after close request:");
  if (
    finalChannelsResponse.result.channels &&
    finalChannelsResponse.result.channels.length > 0
  ) {
    console.log(
      "Channel still exists with properties:",
      finalChannelsResponse.result.channels[0]
    );
    if (finalChannelsResponse.result.channels[0].expiration) {
      console.log(
        `Channel will expire at: ${new Date(
          (finalChannelsResponse.result.channels[0].expiration + 946684800) *
            1000
        ).toISOString()}`
      );
    }
  } else {
    console.log("Channel has been fully closed and removed from the ledger");
  }

  await client.disconnect();
}
