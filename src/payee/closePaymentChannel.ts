import type { PaymentChannelClaim, Wallet, Client } from "xrpl";

export async function closePaymentChannel({
  channelId,
  wallet,
  client,
}: {
  channelId: string;
  wallet: Wallet;
  client: Client;
}): Promise<void> {
  // Request to close the channel immediately
  const closeChannelTx: PaymentChannelClaim = {
    Account: wallet.classicAddress,
    TransactionType: "PaymentChannelClaim",
    Channel: channelId,
    Flags: 2147614720, // tfClose flag
  };

  const closeChannelResponse = await client.submitAndWait(closeChannelTx, {
    wallet: wallet,
    autofill: true,
  });
  // console.log("Close channel response:", closeChannelResponse);
}
