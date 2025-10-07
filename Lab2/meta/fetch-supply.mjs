import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';

const RPC = process.env.RPC_URL ?? 'https://api.devnet.solana.com';
const MINT = process.env.MINT ?? '<PASTE_MINT_ADDRESS>';

const conn = new Connection(RPC, 'confirmed');
const mintInfo = await getMint(conn, new PublicKey(MINT));

console.log('Decimals:', mintInfo.decimals);
console.log('Supply:', mintInfo.supply.toString());