/*
 * Create, claim and verify a Payment Channel.
 * Reference: https://xrpl.org/paychannel.html
 */
import { Client, Wallet, type PaymentChannelFund, type TxResponse } from "xrpl";

import { createPaymentChannel } from "./payer/createPaymentChannel";
import { createPaymentChannelClaim } from "./payer/createPaymentChannelClaim";
import { createPaymentChannelFund } from "./payer/createPaymentChannelFund";

/**
 * Create a payer object with payment channel related functions
 */
export function createPayer(client: Client, wallet: Wallet) {
  return {
    /**
     * Create a payment channel
     */
    createPaymentChannel: ({
      payeeClassicAddress,
      amount,
      settleDelay,
      cancelAfter,
    }: {
      payeeClassicAddress: string;
      amount: string;
      settleDelay: number;
      cancelAfter?: number;
    }) => {
      return createPaymentChannel({
        payeeClassicAddress,
        amount,
        settleDelay,
        client,
        payerWallet: wallet,
        cancelAfter,
      });
    },

    /**
     * Create a payment channel claim (authorization)
     */
    createPaymentChannelClaim: ({
      channelId,
      amount,
    }: {
      channelId: string;
      amount: string;
    }) => {
      return createPaymentChannelClaim({
        channelId,
        amount,
        wallet,
      });
    },

    /**
     * Create a payment channel fund
     */
    createPaymentChannelFund: ({
      channelId,
      amount,
      expiration,
    }: {
      channelId: string;
      amount: string;
      expiration?: number;
    }): Promise<TxResponse<PaymentChannelFund>> => {
      return createPaymentChannelFund({
        channelId,
        amount,
        expiration,
        client,
        payerWallet: wallet,
      });
    },
  };
}
