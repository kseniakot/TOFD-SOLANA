import { DEVNET_PROGRAM_ID, getCpmmPdaAmmConfigId, ClmmConfigLayout, printSimulate } from '@raydium-io/raydium-sdk-v2'
import BN from 'bn.js'
import { initSdk, txVersion, owner as walletOwner } from '../config'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import fs from 'fs'
import path from 'path'
import 'dotenv/config'


const WSOL = 'So11111111111111111111111111111111111111112'
const MY = process.env.MINT ?? '3PzUoo4eDV2cN1drUD43eWnQqT3u9NQ9Xdi3jwvYrfww'

function upsertEnv(key: string, val: string) {
  const envPath = path.resolve(process.cwd(), '.env')
  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
  const re = new RegExp(`^${key}=.*$`, 'm')
  if (re.test(env)) env = env.replace(re, `${key}=${val}`)
  else env += `${env.endsWith('\n') ? '' : '\n'}${key}=${val}\n`
  fs.writeFileSync(envPath, env)
}

function safeStr(v: any) {
  return typeof v === 'string' ? v : v?.toBase58 ? v.toBase58() : String(v)
}

async function loadFeeConfig(connection: any, index: number) {
  const cfgPk = getCpmmPdaAmmConfigId(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, index).publicKey
  const cfgAcc = await connection.getAccountInfo(cfgPk)
  if (!cfgAcc) return null
  const parsed: any = ClmmConfigLayout.decode(cfgAcc.data)
  return {
    id: cfgPk.toBase58(),
    index: Number(parsed.index ?? index),
    tradeFeeRate: Number(parsed.tradeFeeRate ?? 0),
    protocolFeeRate: Number(parsed.protocolFeeRate ?? 0),
    fundFeeRate: Number(parsed.fundFeeRate ?? 0),
    creatorFeeRate: Number(parsed.creatorFeeRate ?? 0),
    createPoolFee:
      parsed.createPoolFee != null && typeof parsed.createPoolFee === 'object'
        ? parsed.createPoolFee.toString()
        : String(parsed.createPoolFee ?? '0'),
  }
}

async function tryCreate(index: number) {
  const raydium = await initSdk()
  const connection = raydium.connection

  const feeConfig = await loadFeeConfig(connection, index)
  if (!feeConfig) throw new Error(`Fee config index ${index} not found`)

  const mintA = { address: WSOL, programId: TOKEN_PROGRAM_ID.toBase58(), decimals: 9 }
  const mintB = { address: MY, programId: TOKEN_PROGRAM_ID.toBase58(), decimals: 6 }

  const mintAAmount = new BN('500000000')
  const mintBAmount = new BN('100000000')

  const { execute, extInfo, transaction } = await raydium.cpmm.createPool({
    programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
    poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
    mintA,
    mintB,
    mintAAmount,
    mintBAmount,
    startTime: new BN(0),
    feeConfig,
    associatedOnly: false,
    ownerInfo: { useSOLBalance: true },
    txVersion,
  })

  printSimulate([transaction])

  const res = await execute({ sendAndConfirm: true }).catch((e: any) => e)
  if (res?.txId && !res?.InstructionError) {
    const { txId } = res
    console.log('pool created:', `https://explorer.solana.com/tx/${txId}?cluster=devnet`)

    const rawId = (extInfo as any)?.address?.poolId
    const poolId = safeStr(rawId)
    console.log('poolId:', poolId)

    const poolKeys = Object.fromEntries(Object.entries((extInfo as any).address).map(([k, v]) => [k, safeStr(v)]))
    console.log('poolKeys:', poolKeys)

    const vaultA = poolKeys.vaultA || poolKeys.reserveA || poolKeys.tokenVaultA || poolKeys.baseVault || ''
    const vaultB = poolKeys.vaultB || poolKeys.reserveB || poolKeys.tokenVaultB || poolKeys.quoteVault || ''

    upsertEnv('POOL_ID', poolId)
    if (vaultA) upsertEnv('VAULT_A', vaultA)
    if (vaultB) upsertEnv('VAULT_B', vaultB)

    const artifact = {
      txId,
      poolId,
      vaultA,
      vaultB,
      address: poolKeys,
    }
    fs.writeFileSync('.raydium-pool.json', JSON.stringify(artifact, null, 2))

    console.log('✅ .env updated:', {
      POOL_ID: poolId,
      VAULT_A: vaultA || '(not provided by SDK)',
      VAULT_B: vaultB || '(not provided by SDK)',
    })
    console.log('📝 saved .raydium-pool.json')
    return true
  } else {
    console.error(`createPool failed on feeConfig index ${index}`, res)
    return false
  }
}

async function main() {
  for (const idx of [0, 1, 2, 3]) {
    const ok = await tryCreate(idx)
    if (ok) return
  }
  console.error('All feeConfig indexes failed. Проверь балансы и ATA, либо пришли логи транзы:')
  console.error('solana confirm -v <TX_ID> --url https://api.devnet.solana.com')
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
