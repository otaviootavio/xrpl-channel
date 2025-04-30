/*
 * Create, claim and verify a Payment Channel.
 * Reference: https://xrpl.org/paychannel.html
 */
import { Client, Wallet } from "xrpl";

import { createPaymentChannel } from "./payer/createPaymentChannel";
import { createPaymentChannelClaim } from "./payer/createPaymentChannelClaim";

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
    }: {
      payeeClassicAddress: string;
      amount: string;
      settleDelay: number;
    }) => {
      return createPaymentChannel({
        payeeClassicAddress,
        amount,
        settleDelay,
        client,
        payerWallet: wallet,
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
  };
}
