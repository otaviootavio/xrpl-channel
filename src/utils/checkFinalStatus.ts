import type { Wallet } from "xrpl";
import { getAccountBalance } from "./getAccountBalance";
import { Client, rippleTimeToISOTime } from "xrpl";
// Function to check final status

export async function checkFinalStatus({
  payerWallet,
  payeeWallet,
  client,
}: {
  payerWallet: Wallet;
  payeeWallet: Wallet;
  client: Client;
}): Promise<void> {
  // Check final balances after attempting to close the channel
  console.log("Final balances after channel close request:");
  console.log(
    `Final balance of ${
      payerWallet.address
    } (payer) is ${await getAccountBalance({
      address: payerWallet.address,
      client: client,
    })} XRP`
  );
  console.log(
    `Final balance of ${
      payeeWallet.address
    } (payee) is ${await getAccountBalance({
      address: payeeWallet.address,
      client: client,
    })} XRP`
  );

  // Check if channel still exists
  const finalChannelsResponse = await client.request({
    command: "account_channels",
    account: payerWallet.classicAddress,
    destination_account: payeeWallet.classicAddress,
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
        `Channel will expire at: ${rippleTimeToISOTime(
          finalChannelsResponse.result.channels[0].expiration
        )}`
      );
    }
  } else {
    console.log("Channel has been fully closed and removed from the ledger");
  }
}
