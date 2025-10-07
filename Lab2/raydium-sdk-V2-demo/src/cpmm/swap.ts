import {
  ApiV3PoolInfoStandardItemCpmm,
  CpmmKeys,
  CurveCalculator,
  FeeOn,
  printSimulate,
} from '@raydium-io/raydium-sdk-v2'
import { initSdk, txVersion } from '../config'
import BN from 'bn.js'
import 'dotenv/config'

async function main() {
  const raydium = await initSdk()

  const poolId = process.env.POOL_ID
  if (!poolId) throw new Error('❌ Set POOL_ID in .env')

  const WSOL = 'So11111111111111111111111111111111111111112'
  const inputMint = WSOL
  const inputAmount = new BN('50000000')

  const { poolInfo, poolKeys, rpcData } = await raydium.cpmm.getPoolInfoFromRpc(poolId)
  if (!poolInfo || !rpcData) throw new Error('Failed to load pool info from RPC')

  if (inputMint !== poolInfo.mintA.address && inputMint !== poolInfo.mintB.address) {
    throw new Error('input mint does not match pool')
  }

  const baseIn = inputMint === poolInfo.mintA.address

  const swapResult = CurveCalculator.swapBaseInput(
    inputAmount,
    baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
    baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
    rpcData.configInfo!.tradeFeeRate,
    rpcData.configInfo!.creatorFeeRate,
    rpcData.configInfo!.protocolFeeRate,
    rpcData.configInfo!.fundFeeRate,
    rpcData.feeOn === FeeOn.BothToken || rpcData.feeOn === FeeOn.OnlyTokenB
  )

  console.log(
    'swap result (expected):',
    Object.fromEntries(Object.entries(swapResult).map(([k, v]) => [k, (v as BN).toString()]))
  )

  const { execute, transaction } = await raydium.cpmm.swap({
    poolInfo: poolInfo as ApiV3PoolInfoStandardItemCpmm,
    poolKeys: poolKeys as CpmmKeys,
    inputAmount,
    swapResult,
    slippage: 0.005,
    baseIn,
    txVersion,
  })

  printSimulate([transaction])

  const { txId } = await execute({ sendAndConfirm: true })
  console.log('swap tx:', `https://explorer.solana.com/tx/${txId}?cluster=devnet`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
