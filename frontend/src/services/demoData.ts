/**
 * `demoData` — lightweight factories that produce demo-style Transaction
 * and LendingPosition objects on demand for the live page.
 *
 * Used by the mempool lanes and the various live panels to seed random
 * data without pulling in the heavier mock generators.
 *
 *   import { makeTransaction, makeLendingPosition } from '@/services/demoData';
 *   const tx = makeTransaction('sandwich');
 */

import type { Transaction } from '@/types';
import type { LendingPosition } from '@/types';

export const TX_TYPE_META = {
  sandwich: {
    label: '三明治',
    class: 'sandwich',
    txClass: 'tx-type-sandwich',
    desc: 'Front-run → Swap → Back-run',
    gas: '98.2 gwei',
    icon: '🥪',
    color: '#ff5e5e',
  },
  arbitrage: {
    label: '套利',
    class: 'arbitrage',
    txClass: 'tx-type-arb',
    desc: 'CEX-DEX 价差套利',
    gas: '87.5 gwei',
    icon: '⚡',
    color: '#ffab40',
  },
  jit: {
    label: 'JIT',
    class: 'jit',
    txClass: 'tx-type-jit',
    desc: '瞬间注入流动性赚取手续费',
    gas: '125.3 gwei',
    icon: '🎯',
    color: '#b388ff',
  },
  liquidation: {
    label: '清算',
    class: 'liquidation',
    txClass: 'tx-type-liquidation',
    desc: 'AAVE 健康因子 < 1.0 清算',
    gas: '156.8 gwei',
    icon: '💥',
    color: '#448aff',
  },
  normal: {
    label: '正常',
    class: 'normal',
    txClass: 'tx-type-normal',
    desc: '普通转账',
    gas: '12.4 gwei',
    icon: '✅',
    color: '#69f0ae',
  },
} as const;

export type TxType = keyof typeof TX_TYPE_META;
export const TX_TYPE_KEYS = Object.keys(TX_TYPE_META) as TxType[];

function hex(len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += '0123456789abcdef'[Math.floor(Math.random() * 16)];
  return s;
}

export interface DemoTransaction extends Omit<Transaction, 'type'> {
  /** MEV-strategy type used by the demo UI. */
  type: TxType;
  mevType: TxType;
  displayHash: string;
}

export function makeTransaction(type?: TxType): DemoTransaction {
  const t: TxType = type ?? TX_TYPE_KEYS[Math.floor(Math.random() * TX_TYPE_KEYS.length)];
  const hash = '0x' + hex(64);
  return {
    hash,
    from: '0x' + hex(40),
    to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    value: 0n,
    gasUsed: 150_000n,
    gasPrice: 25_000_000_000n,
    type: t,
    mevType: t,
    timestamp: Math.floor(Date.now() / 1000),
    blockNumber: 0,
    displayHash: hash.slice(0, 14) + '...' + hash.slice(-6),
  };
}

export function makeLendingPosition(
  protocol: 'AaveV3' | 'Compound' | 'MakerDAO' = 'AaveV3',
): LendingPosition {
  const colAmt = BigInt(Math.floor((1 + Math.random() * 500) * 1e18));
  const colPrice = 2000 + Math.random() * 800;
  const ltv = protocol === 'AaveV3' ? 0.8 : protocol === 'Compound' ? 0.75 : 0.66;
  const liqTh = ltv * 1.03;
  const debtNum = Math.random() * ((Number(colAmt) / 1e18) * colPrice * 0.75);
  const debt = BigInt(Math.max(1, Math.floor(debtNum)));
  const hf = ((Number(colAmt) / 1e18) * colPrice * liqTh) / Number(debt);
  const liqPrice = hf > 0 ? Number(debt) / ((Number(colAmt) / 1e18) * liqTh) : 0;
  return {
    id: 'pos-' + hex(8),
    owner: '0x' + hex(40),
    protocol,
    collateral: { WETH: colAmt },
    debt: { USDC: debt },
    liquidationThresholdE18: BigInt(Math.floor(liqTh * 1e18)),
    timestamp: Math.floor(Date.now() / 1000),
    healthFactor: hf,
    liquidationPrice: liqPrice,
    status: hf > 1.5 ? 'safe' : hf > 1.05 ? 'warning' : hf > 1 ? 'danger' : 'liquidated',
  };
}
