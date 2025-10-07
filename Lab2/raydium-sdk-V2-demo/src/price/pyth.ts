import 'dotenv/config'
import { PriceServiceConnection, PriceFeed } from '@pythnetwork/price-service-client'
import { Connection, PublicKey } from '@solana/web3.js'

const RAYDIUM_API = 'https://api-v3-devnet.raydium.io'
const WSOL_MINT = 'So11111111111111111111111111111111111111112'

const YOUR_MINT = process.env.MINT!
const POOL_ID = process.env.POOL_ID!
const VAULT_A = process.env.VAULT_A
const VAULT_B = process.env.VAULT_B
const RPC_URL = 'https://api.devnet.solana.com'

const FEEDS = {
  SOL_USD: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  BTC_USD: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH_USD: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
} as const

const norm = (s: string) => s.replace(/^0x/i, '').toLowerCase()
const toNum = (x: number | string | bigint) => Number(x)

async function getUsdQuotes() {
  const conn = new PriceServiceConnection('https://hermes.pyth.network', { timeout: 10000 })
  const feeds: PriceFeed[] | undefined = await conn.getLatestPriceFeeds(Object.values(FEEDS))
  if (!feeds?.length) throw new Error('No price feeds')

  const id2sym: Record<string, keyof typeof FEEDS> = {
    [norm(FEEDS.SOL_USD)]: 'SOL_USD',
    [norm(FEEDS.BTC_USD)]: 'BTC_USD',
    [norm(FEEDS.ETH_USD)]: 'ETH_USD',
  }

  const out: Record<string, number> = {}
  for (const f of feeds) {
    const px = f.getPriceUnchecked()
    if (!px) continue
    const val = toNum(px.price) * Math.pow(10, toNum(px.expo ?? 0))
    const sym = id2sym[norm(f.id)]
    if (sym) out[sym] = val
  }
  return out as { SOL_USD: number; BTC_USD: number; ETH_USD: number }
}

async function getPoolViaApi(poolId: string) {
  const r = await fetch(`${RAYDIUM_API}/pools/info/ids?ids=${poolId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`Raydium API ${r.status}`)
  const j = (await r.json()) as any
  if (!j.data?.length) throw new Error('Pool not found in API')
  return j.data[0] as {
    mintA: string
    mintB: string
    mintDecimalsA: number
    mintDecimalsB: number
    reserveA?: string
    reserveB?: string
    vaultA?: string
    vaultB?: string
  }
}

async function getReservesViaVaults() {
  if (!VAULT_A || !VAULT_B) {
    throw new Error('Raydium API blocked (403). Set VAULT_A and VAULT_B in .env (from createCpmmPool log).')
  }
  const connection = new Connection(RPC_URL, 'confirmed')

  const [balA, balB] = await Promise.all([
    connection.getTokenAccountBalance(new PublicKey(VAULT_A)),
    connection.getTokenAccountBalance(new PublicKey(VAULT_B)),
  ])
  const [accAinfo, accBinfo] = await Promise.all([
    connection.getParsedAccountInfo(new PublicKey(VAULT_A)),
    connection.getParsedAccountInfo(new PublicKey(VAULT_B)),
  ])

  const mintA = (accAinfo.value as any)?.data?.parsed?.info?.mint as string
  const mintB = (accBinfo.value as any)?.data?.parsed?.info?.mint as string
  if (!mintA || !mintB) throw new Error('Failed to read vault mints')

  const R_A = balA.value.uiAmount ?? Number(balA.value.amount) / 10 ** balA.value.decimals
  const R_B = balB.value.uiAmount ?? Number(balB.value.amount) / 10 ** balB.value.decimals

  return {
    mintA,
    mintB,
    uiReserveA: R_A,
    uiReserveB: R_B,
  }
}

async function main() {
  if (!YOUR_MINT || !POOL_ID) throw new Error('Set MINT and POOL_ID in .env')

  const { SOL_USD, BTC_USD, ETH_USD } = await getUsdQuotes()

  let priceYourWsol: number

  try {
    const p = await getPoolViaApi(POOL_ID)
    const aIsYour = p.mintA.toLowerCase() === YOUR_MINT.toLowerCase()
    const bIsYour = p.mintB.toLowerCase() === YOUR_MINT.toLowerCase()
    const aIsWsol = p.mintA.toLowerCase() === WSOL_MINT.toLowerCase()
    const bIsWsol = p.mintB.toLowerCase() === WSOL_MINT.toLowerCase()
    if (!((aIsYour && bIsWsol) || (aIsWsol && bIsYour))) {
      throw new Error('Pool is not YOUR/WSOL — check mints')
    }
    const rA = (p.reserveA ?? p.vaultA) as string
    const rB = (p.reserveB ?? p.vaultB) as string
    if (!rA || !rB) throw new Error('No reserves in API payload')

    const dYour = aIsYour ? p.mintDecimalsA : p.mintDecimalsB
    const dWsol = aIsYour ? p.mintDecimalsB : p.mintDecimalsA
    const Ryour = (aIsYour ? Number(rA) : Number(rB)) / 10 ** dYour
    const Rwsol = (aIsYour ? Number(rB) : Number(rA)) / 10 ** dWsol

    priceYourWsol = Rwsol / Ryour
    console.log('(via Raydium API)')
  } catch (e: any) {
    console.warn('Raydium API failed, falling back to on-chain via vaults:', e?.message ?? e)
    const v = await getReservesViaVaults()

    let Ryour: number, Rwsol: number
    if (v.mintA.toLowerCase() === YOUR_MINT.toLowerCase() && v.mintB === WSOL_MINT) {
      Ryour = v.uiReserveA
      Rwsol = v.uiReserveB
    } else if (v.mintB.toLowerCase() === YOUR_MINT.toLowerCase() && v.mintA === WSOL_MINT) {
      Ryour = v.uiReserveB
      Rwsol = v.uiReserveA
    } else {
      throw new Error('Vaults are not YOUR/WSOL — check VAULT_A/VAULT_B or MINT')
    }

    priceYourWsol = Rwsol / Ryour
    console.log('(via on-chain vaults)')
  }

  const priceYourUsdc = priceYourWsol * SOL_USD
  const priceYourBtc = priceYourUsdc / BTC_USD
  const priceYourEth = priceYourUsdc / ETH_USD

  console.log('--- Pyth (USD) ---')
  console.log({ SOL_USD, BTC_USD, ETH_USD })
  console.log('--- Prices ---')
  console.log({
    'YOUR/WSOL': priceYourWsol,
    'YOUR/USDC': priceYourUsdc,
    'YOUR/BTC': priceYourBtc,
    'YOUR/ETH': priceYourEth,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
