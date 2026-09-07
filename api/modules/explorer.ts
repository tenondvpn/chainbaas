import axios from 'axios'

// Direct axios call so baseUrl can be any origin (enables cross-shard queries).
// When baseUrl is empty the path is relative → handled by Vite proxy in dev.
const explorerGet = (path: string, params: any = {}, baseUrl = ''): Promise<any> =>
  axios.get(`${baseUrl}${path}`, { params }).then(r => r.data)

export const getBlocks = (params: any = {}, baseUrl = '') =>
  explorerGet('/explorer/blocks', params, baseUrl)

export const getBlock = (hash: string, baseUrl = '') =>
  explorerGet('/explorer/block', { hash }, baseUrl)

export const getTransactions = (params: any = {}, baseUrl = '') =>
  explorerGet('/explorer/transactions', params, baseUrl)

export const getTransaction = (txHash: string, baseUrl = '') =>
  explorerGet('/explorer/transaction', { tx_hash: txHash }, baseUrl)

export const getAddress = (addr: string, baseUrl = '') =>
  explorerGet('/explorer/address', { addr }, baseUrl)

export const getAddressTxs = (addr: string, params: any = {}, baseUrl = '') =>
  explorerGet('/explorer/address_txs', { addr, ...params }, baseUrl)

export const getContracts = (params: any = {}, baseUrl = '') =>
  explorerGet('/explorer/contracts', params, baseUrl)

export const getContract = (addr: string, baseUrl = '') =>
  explorerGet('/explorer/contract', { addr }, baseUrl)

export const getGasPresets = (baseUrl = '') =>
  explorerGet('/explorer/gas-presets', {}, baseUrl)

export const getChainInfo = (baseUrl = '') =>
  explorerGet('/explorer/chain-info', {}, baseUrl)
