import { type Client, type PaymentChannelFund, type TxResponse, type Wallet } from "xrpl";

export async function createPaymentChannelFund({
  amount,
  client,
  payerWallet,
  expiration,
  channelId,
}: {
  amount: string;
  client: Client;
  payerWallet: Wallet;
  expiration?: number;
  channelId: string;
}): Promise<TxResponse<PaymentChannelFund>> {
  const paymentChannelFundTx: PaymentChannelFund = {
    TransactionType: "PaymentChannelFund",
    Account: payerWallet.classicAddress,
    Amount: amount,
    Expiration: expiration,
    Channel: channelId,
  };

  const paymentChannelCreateResponse = await client.submitAndWait(
    paymentChannelFundTx,
    {
      wallet: payerWallet,
      autofill: true,
    }
  );

  return paymentChannelCreateResponse;
}
