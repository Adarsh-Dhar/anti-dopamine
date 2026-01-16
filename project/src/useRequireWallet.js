import { useWallet } from '@solana/wallet-adapter-react';

export function useRequireWallet() {
  const { connected } = useWallet();
  return connected;
}
