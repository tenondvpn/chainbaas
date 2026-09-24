<template>
    <div class="explorer-container">
        <el-card class="explorer-card" shadow="always">
            <template #header>
                <div class="card-header">
                    <el-icon size="24" color="var(--el-color-primary)"><Search /></el-icon>
                    <span class="title">Blockchain Explorer</span>
                    <el-tag v-if="networkOnline" type="success" size="small" style="margin-left:auto">Network Online</el-tag>
                    <el-tag v-else-if="networkChecked" type="danger" size="small" style="margin-left:auto">Network Offline</el-tag>
                    <el-tag v-else type="info" size="small" style="margin-left:auto">Checking...</el-tag>
                </div>
            </template>

            <!-- Shard status -->
            <div class="shard-status-row">
                <el-tooltip v-for="s in shardStatuses" :key="s.shard"
                    :content="s.online ? `Shard ${s.shard}: ${s.responseMs}ms` : `Shard ${s.shard}: offline`">
                    <el-tag :type="s.online ? 'success' : 'danger'" size="small" style="cursor:default">
                        S{{ s.shard }} {{ s.online ? '●' : '○' }}
                    </el-tag>
                </el-tooltip>
                <el-button size="small" @click="refreshAll" :loading="checkingStatus" style="margin-left:8px">刷新</el-button>
            </div>

            <!-- Search -->
            <el-form @submit.prevent="search" style="margin:12px 0 8px">
                <el-input v-model="query" placeholder="搜索地址 / 区块Hash / 交易Hash" size="large" clearable @keyup.enter="search">
                    <template #prepend>
                        <!-- Shard 2 is the root congress network and owns no
                             normal accounts, so it is not offered here. -->
                        <el-select v-model="selectedShard" style="width:110px">
                            <el-option label="Auto (all)" value="auto" />
                            <el-option v-for="s in SHARDS" :key="s" :label="`Shard ${s}`" :value="s" />
                        </el-select>
                    </template>
                    <template #append>
                        <el-button type="primary" :loading="loading" @click="search">Search</el-button>
                    </template>
                </el-input>
            </el-form>
            <el-alert v-if="error" :title="error" type="error" show-icon closable @close="error=''" style="margin-bottom:12px" />

            <!-- Shard + Pool selector -->
            <div class="shard-view-row">
                <span class="shard-view-label">分片：</span>
                <el-radio-group v-model="viewShard" size="small" @change="onViewShardChange">
                    <el-radio-button v-for="s in [2,3,4,5,6]" :key="s" :value="s">Shard {{ s }}</el-radio-button>
                </el-radio-group>
                <span class="shard-view-label" style="margin-left:16px">Pool：</span>
                <el-select v-model="viewPool" placeholder="全部" clearable size="small"
                    style="width:200px" :loading="poolsLoading" @change="onViewPoolChange">
                    <el-option label="全部 Pool" :value="null" />
                    <el-option v-for="p in poolList" :key="p.idx"
                        :label="`Pool ${p.idx}  (高度 ${p.height})`" :value="p.idx" />
                </el-select>
            </div>

            <!-- Latest Blocks | Latest Transactions -->
            <el-row :gutter="16" style="margin-top:8px">
                <el-col :span="12" :xs="24">
                    <div class="section-header">
                        <span>
                            {{ searchMode==='block' ? '区块搜索结果' : `最新区块 (Shard ${viewShard}${viewPool !== null ? ` / Pool ${viewPool}` : ''})` }}
                            <el-tag v-if="searchMode==='block'" size="small" type="warning" style="margin-left:6px;cursor:pointer" @click="clearSearch">× 清除</el-tag>
                        </span>
                        <el-button size="small" link :loading="blocksLoading" @click="loadLatestBlocks">刷新</el-button>
                    </div>
                    <el-skeleton v-if="blocksLoading && !latestBlocks.length" :rows="5" animated />
                    <el-table v-else :data="latestBlocks" stripe size="small" style="width:100%">
                        <el-table-column label="高度" width="68">
                            <template #default="{ row }">
                                <span class="link-text" @click="openBlockDetail(row)">{{ row.blockInfo?.height }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column label="Pool" width="50">
                            <template #default="{ row }">{{ row.poolIndex }}</template>
                        </el-table-column>
                        <el-table-column label="时间" min-width="100">
                            <template #default="{ row }">{{ fmtTs(row.blockInfo?.timestamp) }}</template>
                        </el-table-column>
                        <el-table-column label="Gas" width="85">
                            <template #default="{ row }">{{ row.blockInfo?.allGas }}</template>
                        </el-table-column>
                        <el-table-column label="地址变更" width="72">
                            <template #default="{ row }">
                                <el-tag size="small" :type="(row._addrCount||0)>0?'primary':'info'">
                                    {{ row._addrCount ?? 0 }}
                                </el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column label="" width="55">
                            <template #default="{ row }">
                                <el-button size="small" link type="primary" @click="openBlockDetail(row)">详情</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                    <div v-if="!blocksLoading && !latestBlocks.length" class="no-data">暂无区块数据</div>
                </el-col>

                <el-col :span="12" :xs="24">
                    <div class="section-header">
                        <span>
                            {{ searchMode==='tx' ? '交易搜索结果' : `最新交易 (Shard ${viewShard}${viewPool !== null ? ` / Pool ${viewPool}` : ''})` }}
                            <el-tag v-if="searchMode==='tx'" size="small" type="warning" style="margin-left:6px;cursor:pointer" @click="clearSearch">× 清除</el-tag>
                        </span>
                        <el-button size="small" link :loading="activityLoading" @click="loadNetworkActivity">刷新</el-button>
                    </div>
                    <el-skeleton v-if="activityLoading && !networkTxs.length" :rows="5" animated />
                    <el-table v-else :data="networkTxs" stripe size="small" style="width:100%">
                        <el-table-column label="高度" prop="height" width="68" />
                        <el-table-column label="Pool" prop="poolIndex" width="50" />
                        <el-table-column label="TxIdx" prop="txIndex" width="55" />
                        <el-table-column label="地址数" width="60">
                            <template #default="{ row }">
                                <el-tag size="small" type="primary">{{ row.addrCount }}</el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column label="时间" min-width="100">
                            <template #default="{ row }">{{ fmtTs(row.timestamp) }}</template>
                        </el-table-column>
                        <el-table-column label="" width="55">
                            <template #default="{ row }">
                                <el-button size="small" link type="primary" @click="openNetworkTxDrawer(row)">查看</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                    <div v-if="!activityLoading && !networkTxs.length" class="no-data">暂无交易数据</div>
                </el-col>
            </el-row>


            <!-- Chain addresses (from node DB via /get_all_accounts) -->
            <div class="section">
                <div class="section-header">
                    <span>
                        {{ searchMode==='address' ? '地址搜索结果' : `链上地址 (Shard ${viewShard}${viewPool !== null ? ` / Pool ${viewPool}` : ''})` }}
                        <el-tag v-if="searchMode==='address'" size="small" type="warning" style="margin-left:6px;cursor:pointer" @click="clearSearch">× 清除</el-tag>
                    </span>
                    <el-button size="small" link :loading="addrListLoading" @click="loadChainAddresses(0)">刷新</el-button>
                </div>

                <!-- Address filter -->
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
                    <el-input v-model="addrFilter" placeholder="过滤地址" size="small" clearable style="max-width:320px" />
                </div>

                <el-skeleton v-if="addrListLoading && !chainAddresses.length" :rows="4" animated />
                <div v-else-if="!addrListLoading && !chainAddresses.length" class="no-data">暂无地址数据</div>

                <el-table v-else :data="filteredChainAddresses" stripe size="small" style="width:100%" max-height="380">
                    <el-table-column label="地址" min-width="300">
                        <template #default="{ row }">
                            <span class="mono addr-cell addr-full" @click="fillSearch(row.address, row.sharding_id)">
                                {{ row.address }}
                            </span>
                        </template>
                    </el-table-column>
                    <el-table-column label="Pool" prop="pool_index" width="52" />
                    <el-table-column label="余额" min-width="120">
                        <template #default="{ row }"><span class="mono">{{ row.balance }}</span></template>
                    </el-table-column>
                    <el-table-column label="Nonce" prop="nonce" width="65" />
                    <el-table-column label="高度" prop="latest_height" width="75" />
                    <el-table-column label="" width="72">
                        <template #default="{ row }">
                            <el-button size="small" @click="openAddrTxDrawer(row.address, row.sharding_id)">查看</el-button>
                        </template>
                    </el-table-column>
                </el-table>

                <!-- Pagination -->
                <div v-if="addrListHasMore || addrCursorStack.length > 0" class="pagination-row">
                    <el-button :disabled="addrCursorStack.length===0" size="small" @click="addrListPrevPage">上一页</el-button>
                    <el-button :disabled="!addrListHasMore" size="small" @click="addrListNextPage">下一页</el-button>
                </div>
            </div>

            <!-- Smart Contracts -->
            <div class="section">
                <div class="section-header">
                    <span>智能合约 (Shard {{ viewShard }})</span>
                    <el-button size="small" link :loading="contractsLoading" @click="loadContracts(0)">刷新</el-button>
                </div>
                <el-skeleton v-if="contractsLoading && !contractsList.length" :rows="3" animated />
                <div v-else-if="!contractsLoading && !contractsList.length" class="no-data">暂无合约数据</div>
                <el-table v-else :data="contractsList" stripe size="small" style="width:100%" max-height="300">
                    <el-table-column label="合约地址" min-width="300">
                        <template #default="{ row }">
                            <span class="mono addr-cell addr-full">{{ row.addr }}</span>
                        </template>
                    </el-table-column>
                    <el-table-column label="创建者" min-width="160" show-overflow-tooltip>
                        <template #default="{ row }">
                            <span class="mono addr-cell">{{ shortAddr(row.creator_addr) }}</span>
                        </template>
                    </el-table-column>
                    <el-table-column label="高度" prop="create_height" width="90" />
                    <el-table-column label="源码" width="65">
                        <template #default="{ row }">
                            <el-tag size="small" :type="row.source_code ? 'success' : 'info'">{{ row.source_code ? '有' : '无' }}</el-tag>
                        </template>
                    </el-table-column>
                    <el-table-column label="" width="70">
                        <template #default="{ row }">
                            <el-button size="small" @click="openContractDetail(row)">查看</el-button>
                        </template>
                    </el-table-column>
                </el-table>
                <div v-if="contractsHasMore || contractsCursorStack.length > 0" class="pagination-row">
                    <el-button :disabled="contractsCursorStack.length===0" size="small" @click="contractsPrevPage">上一页</el-button>
                    <el-button :disabled="!contractsHasMore" size="small" @click="contractsNextPage">下一页</el-button>
                </div>
            </div>

            <!-- Genesis accounts -->
            <div v-if="genesisBalances.length>0" class="section">
                <el-divider content-position="left">创世账户</el-divider>
                <el-table :data="genesisBalances" stripe size="small" style="width:100%">
                    <el-table-column label="标签" prop="label" width="200" />
                    <el-table-column label="分片" prop="shard" width="60" />
                    <el-table-column label="地址" min-width="320">
                        <template #default="{ row }">
                            <span class="mono addr-cell addr-full" @click="fillSearch(row.address, row.shard)">{{ row.address }}</span>
                        </template>
                    </el-table-column>
                    <el-table-column label="余额" width="140">
                        <template #default="{ row }">
                            <span v-if="row.loading"><el-icon class="is-loading"><Loading /></el-icon></span>
                            <span v-else-if="row.balance!==null" class="mono">{{ row.balance }}</span>
                            <span v-else class="text-muted">—</span>
                        </template>
                    </el-table-column>
                    <el-table-column label="" width="72">
                        <template #default="{ row }">
                            <el-button size="small" @click="openAddrTxDrawer(row.address, row.shard)">查看</el-button>
                        </template>
                    </el-table-column>
                </el-table>
            </div>
        </el-card>

        <!-- ═══ Block Detail Dialog ════════════════════════════════════ -->
        <el-dialog v-model="blockDetailVisible" title="区块详情" width="900px"
            destroy-on-close append-to-body :close-on-click-modal="true">
            <template v-if="selectedBlock">
                <!-- Block metadata -->
                <p class="dlg-section-title">区块元信息</p>
                <el-descriptions :column="3" border size="small">
                    <el-descriptions-item label="高度">{{ selectedBlock.blockInfo?.height }}</el-descriptions-item>
                    <el-descriptions-item label="Pool">{{ selectedBlock.poolIndex }}</el-descriptions-item>
                    <el-descriptions-item label="Shard">{{ selectedBlock.shardId }}</el-descriptions-item>
                    <el-descriptions-item label="时间">{{ fmtTs(selectedBlock.blockInfo?.timestamp) }}</el-descriptions-item>
                    <el-descriptions-item label="Gas">{{ selectedBlock.blockInfo?.allGas }}</el-descriptions-item>
                    <el-descriptions-item label="版本">{{ selectedBlock.blockInfo?.version }}</el-descriptions-item>
                    <el-descriptions-item label="ChainId">{{ selectedBlock.blockInfo?.chainId }}</el-descriptions-item>
                    <el-descriptions-item label="TimeblockH">{{ selectedBlock.blockInfo?.timeblockHeight }}</el-descriptions-item>
                    <el-descriptions-item label="ConsistRand">{{ selectedBlock.blockInfo?.consistencyRandom }}</el-descriptions-item>
                </el-descriptions>

                <!-- QC info -->
                <p class="dlg-section-title" style="margin-top:14px">共识证明 (QC)</p>
                <el-descriptions :column="3" border size="small">
                    <el-descriptions-item label="View">{{ selectedBlock.qc?.view }}</el-descriptions-item>
                    <el-descriptions-item label="LeaderIdx">{{ selectedBlock.qc?.leaderIdx }}</el-descriptions-item>
                    <el-descriptions-item label="NetworkId">{{ selectedBlock.qc?.networkId }}</el-descriptions-item>
                    <el-descriptions-item label="ElectH">{{ selectedBlock.qc?.electHeight }}</el-descriptions-item>
                    <el-descriptions-item label="TmHeight">{{ selectedBlock.qc?.tmHeight }}</el-descriptions-item>
                    <el-descriptions-item label="QcPool">{{ selectedBlock.qc?.poolIndex }}</el-descriptions-item>
                    <el-descriptions-item label="BlockHash" :span="3">
                        <span class="mono" style="font-size:11px;word-break:break-all">{{ b64ToHex(selectedBlock.qc?.viewBlockHash) }}</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="ParentHash" :span="3">
                        <span class="mono" style="font-size:11px;word-break:break-all">{{ b64ToHex(selectedBlock.parentHash) }}</span>
                    </el-descriptions-item>
                </el-descriptions>

                <!-- Transaction list -->
                <div class="section-header" style="margin-top:16px">
                    <span>交易列表（{{ blockTxLoading ? '加载中...' : blockTxList.length + ' 笔' }}）</span>
                    <el-icon v-if="blockTxLoading" class="is-loading" style="margin-left:6px"><Loading /></el-icon>
                </div>

                <el-empty v-if="!blockTxLoading && blockTxList.length===0" description="空块，无交易" :image-size="50" />
                <el-table v-else :data="blockTxList" stripe border size="small" style="width:100%">
                    <el-table-column label="TxIdx" prop="txIndex" width="62" />
                    <el-table-column label="发送方" min-width="130">
                        <template #default="{ row }">
                            <el-tooltip v-if="row.txItem?.from" :content="row.txItem.from" placement="top">
                                <span class="mono addr-cell" @click="viewBlockAddr(row.txItem.from)">{{ shortAddr(row.txItem.from) }}</span>
                            </el-tooltip>
                            <span v-else class="mono text-muted">{{ shortAddr(b64ToAddrLocal(row.addresses[0]?.addr)) }}</span>
                        </template>
                    </el-table-column>
                    <el-table-column label="接收方" min-width="130">
                        <template #default="{ row }">
                            <el-tooltip v-if="row.txItem?.to" :content="row.txItem.to" placement="top">
                                <span class="mono addr-cell" @click="viewBlockAddr(row.txItem.to)">{{ shortAddr(row.txItem.to) }}</span>
                            </el-tooltip>
                            <span v-else class="text-muted">—</span>
                        </template>
                    </el-table-column>
                    <el-table-column label="金额" width="110">
                        <template #default="{ row }">
                            <span v-if="row.txItem" class="mono">{{ row.txItem.amount }}</span>
                            <span v-else class="text-muted">—</span>
                        </template>
                    </el-table-column>
                    <el-table-column label="状态" width="60">
                        <template #default="{ row }">
                            <el-tag v-if="row.txItem" :type="row.txItem.status===0?'success':'danger'" size="small">
                                {{ row.txItem.status===0?'OK':row.txItem.status }}
                            </el-tag>
                            <span v-else class="text-muted">—</span>
                        </template>
                    </el-table-column>
                    <el-table-column label="地址变更" width="72">
                        <template #default="{ row }">
                            <el-tag size="small" type="primary">{{ row.addresses.length }}</el-tag>
                        </template>
                    </el-table-column>
                    <el-table-column label="" width="55">
                        <template #default="{ row }">
                            <el-button size="small" type="primary" link @click="openBlockTxDetail(row)">详情</el-button>
                        </template>
                    </el-table-column>
                </el-table>

                <!-- KV changes (block-level) -->
                <template v-if="getBlockKVLocal(selectedBlock).length > 0">
                    <p class="dlg-section-title" style="margin-top:14px">
                        合约存储变更 KV（共 {{ getBlockKVLocal(selectedBlock).length }} 条）
                    </p>
                    <el-table :data="getBlockKVLocal(selectedBlock)" stripe border size="small" style="width:100%">
                        <el-table-column label="地址" width="130">
                            <template #default="{ row }">
                                <span class="mono" style="font-size:11px">{{ shortAddr(b64ToAddrLocal(row.addr)) }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column label="Key" min-width="160">
                            <template #default="{ row }">
                                <span class="mono" style="font-size:11px;word-break:break-all">{{ b64ToHex(row.key) }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column label="Value" min-width="160">
                            <template #default="{ row }">
                                <span class="mono" style="font-size:11px;word-break:break-all">{{ b64ToHex(row.value) }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column label="高度" prop="height" width="65" />
                    </el-table>
                </template>
            </template>
        </el-dialog>

        <!-- ═══ Address Transaction Drawer ══════════════════════════ -->
        <el-drawer v-model="addrTxDrawerVisible" direction="rtl" size="700px"
            destroy-on-close append-to-body>
            <template #header>
                <div>
                    <div style="font-weight:600;font-size:14px">地址交易记录</div>
                    <div class="mono text-muted" style="font-size:11px;margin-top:2px;word-break:break-all">
                        {{ addrTxAddr }} (Shard {{ addrTxShard }})
                    </div>
                </div>
            </template>

            <div v-if="addrTxLoading && !addrTxList.length"
                style="text-align:center;padding:32px;color:var(--el-text-color-secondary)">
                <el-icon class="is-loading" size="20"><Loading /></el-icon>
                <span style="margin-left:8px">加载中...</span>
            </div>
            <div v-else-if="!addrTxList.length" class="no-data">该地址暂无交易记录</div>
            <el-table v-else :data="addrTxList" stripe border size="small" style="width:100%">
                <el-table-column label="高度" prop="height" width="75" />
                <el-table-column label="TxIdx" prop="txIndex" width="58" />
                <el-table-column label="发送方" min-width="130">
                    <template #default="{ row }">
                        <el-tooltip :content="row.from" placement="top">
                            <span class="mono addr-cell">{{ shortAddr(row.from) }}</span>
                        </el-tooltip>
                    </template>
                </el-table-column>
                <el-table-column label="接收方" min-width="130">
                    <template #default="{ row }">
                        <el-tooltip :content="row.to" placement="top">
                            <span class="mono addr-cell">{{ shortAddr(row.to) }}</span>
                        </el-tooltip>
                    </template>
                </el-table-column>
                <el-table-column label="金额" prop="amount" width="110" />
                <el-table-column label="状态" width="60">
                    <template #default="{ row }">
                        <el-tag :type="row.status===0?'success':'danger'" size="small">{{ row.status===0?'OK':row.status }}</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="" width="55">
                    <template #default="{ row }">
                        <el-button size="small" link type="primary" @click="openAcctTxDetail(row)">详情</el-button>
                    </template>
                </el-table-column>
            </el-table>
            <div class="pagination-row" v-if="addrTxList.length >= addrTxLimit || addrTxOffset > 0">
                <el-button :disabled="addrTxOffset===0 || addrTxLoading" size="small" @click="addrTxPrevPage">上一页</el-button>
                <span class="page-info">第 {{ Math.floor(addrTxOffset/addrTxLimit)+1 }} 页</span>
                <el-button :disabled="addrTxList.length<addrTxLimit || addrTxLoading" size="small" @click="addrTxNextPage">下一页</el-button>
            </div>
        </el-drawer>

        <!-- ═══ Contract Detail Drawer ═════════════════════════════════ -->
        <el-drawer v-model="contractDetailVisible" direction="rtl" size="780px"
            destroy-on-close append-to-body>
            <template #header>
                <div>
                    <div style="font-weight:600;font-size:14px">合约详情</div>
                    <div class="mono text-muted" style="font-size:11px;margin-top:2px;word-break:break-all">
                        {{ contractDetail?.addr }}
                    </div>
                </div>
            </template>
            <template v-if="contractDetail">
                <el-descriptions :column="2" border size="small" style="margin-bottom:12px">
                    <el-descriptions-item label="合约地址" :span="2">
                        <span class="mono" style="font-size:11px;word-break:break-all">{{ contractDetail.addr }}</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="创建者" :span="2">
                        <span class="mono" style="font-size:11px;word-break:break-all">{{ contractDetail.creator_addr }}</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="创建交易" :span="2">
                        <span class="mono" style="font-size:11px;word-break:break-all">{{ contractDetail.create_tx_hash }}</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="创建高度">{{ contractDetail.create_height }}</el-descriptions-item>
                    <el-descriptions-item label="分片/Pool">{{ contractDetail.shard_id }} / {{ contractDetail.pool_index }}</el-descriptions-item>
                    <el-descriptions-item label="创建时间" :span="2">{{ fmtTs(String(contractDetail.create_timestamp)) }}</el-descriptions-item>
                </el-descriptions>

                <el-tabs>
                    <el-tab-pane v-if="contractDetail.source_code" label="源码">
                        <pre style="background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:4px;overflow:auto;max-height:420px;font-size:12px;margin:0">{{ contractDetail.source_code }}</pre>
                    </el-tab-pane>
                    <el-tab-pane v-if="contractDetail.abi" label="ABI">
                        <pre style="background:#f5f5f5;padding:12px;border-radius:4px;overflow:auto;max-height:420px;font-size:12px;margin:0">{{ formatAbiJson(contractDetail.abi) }}</pre>
                    </el-tab-pane>
                    <el-tab-pane label="交易记录">
                        <div v-if="contractTxsLoading && !contractTxsList.length"
                            style="text-align:center;padding:24px;color:var(--el-text-color-secondary)">
                            <el-icon class="is-loading" size="18"><Loading /></el-icon>
                            <span style="margin-left:8px">加载中...</span>
                        </div>
                        <div v-else-if="!contractTxsList.length" class="no-data">暂无交易记录</div>
                        <el-table v-else :data="contractTxsList" stripe border size="small" style="width:100%">
                            <el-table-column label="高度" prop="height" width="80" />
                            <el-table-column label="TxHash" min-width="120" show-overflow-tooltip>
                                <template #default="{ row }">
                                    <span class="mono" style="font-size:11px">{{ shortAddr(row.tx_hash) }}</span>
                                </template>
                            </el-table-column>
                            <el-table-column label="发送方" min-width="120" show-overflow-tooltip>
                                <template #default="{ row }">
                                    <span class="mono" style="font-size:11px">{{ shortAddr(row.from_addr) }}</span>
                                </template>
                            </el-table-column>
                            <el-table-column label="金额" prop="amount" width="100" />
                            <el-table-column label="时间" min-width="120">
                                <template #default="{ row }">{{ fmtTs(String(row.timestamp)) }}</template>
                            </el-table-column>
                        </el-table>
                        <div class="pagination-row" v-if="contractTxsList.length >= contractTxsLimit || contractTxsOffset > 0">
                            <el-button :disabled="contractTxsOffset===0 || contractTxsLoading" size="small" @click="contractTxsPrevPage">上一页</el-button>
                            <el-button :disabled="contractTxsList.length<contractTxsLimit || contractTxsLoading" size="small" @click="contractTxsNextPage">下一页</el-button>
                        </div>
                    </el-tab-pane>
                </el-tabs>
            </template>
        </el-drawer>

        <!-- ═══ Unified Transaction Detail Drawer ════════════════════ -->
        <el-drawer v-model="txDetailDrawerVisible" title="交易详情"
            size="680px" direction="rtl" destroy-on-close append-to-body>

            <!-- Loading spinner (enrichment) -->
            <div v-if="txEnrichLoading && !selectedTxItem"
                style="text-align:center;padding:24px;color:var(--el-text-color-secondary)">
                <el-icon class="is-loading" size="20"><Loading /></el-icon>
                <span style="margin-left:8px">正在加载链上交易数据...</span>
            </div>

            <!-- ① 交易信息 (from query_account_txs — shown first, same format everywhere) -->
            <template v-if="selectedTxItem">
                <p class="dlg-section-title">交易信息</p>
                <el-descriptions :column="2" border size="small">
                    <el-descriptions-item label="区块高度">{{ selectedTxItem.height }}</el-descriptions-item>
                    <el-descriptions-item label="TxIndex">{{ selectedTxItem.txIndex }}</el-descriptions-item>
                    <el-descriptions-item label="Nonce">{{ selectedTxItem.nonce }}</el-descriptions-item>
                    <el-descriptions-item label="Step">{{ selectedTxItem.step }}</el-descriptions-item>
                    <el-descriptions-item label="状态">
                        <el-tag :type="selectedTxItem.status===0?'success':'danger'" size="small">
                            {{ selectedTxItem.status===0?'成功':selectedTxItem.status }}
                        </el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="金额">{{ selectedTxItem.amount }}</el-descriptions-item>
                    <el-descriptions-item label="Gas Limit">{{ selectedTxItem.gasLimit }}</el-descriptions-item>
                    <el-descriptions-item label="Gas Used">{{ selectedTxItem.gasUsed }}</el-descriptions-item>
                    <el-descriptions-item label="Gas Price">{{ selectedTxItem.gasPrice }}</el-descriptions-item>
                    <el-descriptions-item label="余额 (After)">{{ selectedTxItem.balance }}</el-descriptions-item>
                    <el-descriptions-item label="发送方" :span="2">
                        <span class="mono addr-cell addr-full" @click="viewAddrFromDrawer(selectedTxItem.from)">{{ selectedTxItem.from }}</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="接收方" :span="2">
                        <span class="mono addr-cell addr-full" @click="viewAddrFromDrawer(selectedTxItem.to)">{{ selectedTxItem.to }}</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="TxHash" :span="2">
                        <span class="mono" style="word-break:break-all">{{ selectedTxItem.txHash }}</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="UniqueHash" :span="2">
                        <span class="mono" style="word-break:break-all">{{ selectedTxItem.uniqueHash }}</span>
                    </el-descriptions-item>
                </el-descriptions>
            </template>

            <!-- ② 地址状态变更 (from block addressArray — shown when opened from block context) -->
            <template v-if="selectedTxGroup">
                <p class="dlg-section-title" :style="selectedTxItem ? 'margin-top:18px' : ''">
                    地址状态变更
                    <span v-if="!selectedTxItem && !txEnrichLoading" class="text-muted" style="font-size:11px;font-weight:400;margin-left:8px">
                        (区块高度 {{ selectedBlock?.blockInfo?.height }} · Pool {{ selectedBlock?.poolIndex }} · TxIdx {{ selectedTxGroup.txIndex }})
                    </span>
                </p>
                <el-table :data="selectedTxGroup.addresses" stripe border size="small" style="width:100%">
                    <el-table-column label="地址" min-width="150">
                        <template #default="{ row }">
                            <el-tooltip :content="b64ToAddrLocal(row.addr)" placement="top">
                                <span class="mono addr-cell" @click="viewAddrFromDrawer(b64ToAddrLocal(row.addr))">
                                    {{ shortAddr(b64ToAddrLocal(row.addr)) }}
                                </span>
                            </el-tooltip>
                        </template>
                    </el-table-column>
                    <el-table-column label="余额" min-width="110">
                        <template #default="{ row }"><span class="mono">{{ row.balance }}</span></template>
                    </el-table-column>
                    <el-table-column label="Nonce" prop="nonce" width="60" />
                    <el-table-column label="类型" prop="type" width="88" />
                    <el-table-column label="PoolIdx" prop="poolIndex" width="62" />
                    <el-table-column label="ShardId" prop="shardingId" width="62" />
                    <el-table-column label="合约" width="55">
                        <template #default="{ row }">
                            <el-tag v-if="row.bytesCode" size="small" type="warning">有</el-tag>
                            <span v-else class="text-muted">—</span>
                        </template>
                    </el-table-column>
                </el-table>

                <!-- KV changes -->
                <template v-if="selectedTxGroup.kvChanges.length > 0">
                    <p class="dlg-section-title" style="margin-top:14px">合约存储变更 KV</p>
                    <el-table :data="selectedTxGroup.kvChanges" stripe border size="small" style="width:100%">
                        <el-table-column label="Key" min-width="180">
                            <template #default="{ row }">
                                <span class="mono" style="font-size:11px;word-break:break-all">{{ b64ToHex(row.key) }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column label="Value" min-width="180">
                            <template #default="{ row }">
                                <span class="mono" style="font-size:11px;word-break:break-all">{{ b64ToHex(row.value) }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column label="高度" prop="height" width="65" />
                    </el-table>
                </template>
            </template>
        </el-drawer>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Search, Loading } from '@element-plus/icons-vue'
import {
    queryAccount, queryAccountOnShard, queryAccountTxsOnShard,
    checkNetworkStatus, GENESIS_ACCOUNTS, SHARDS,
    getLatestNetworkBlocks, getNetworkTransactions,
    getLatestPoolInfo, getBlocks,
    getAllAccounts, explorerGetBlock, explorerGetTx,
    explorerGetContracts, explorerGetContractTxs,
    type ShardStatus, type TxItem, type NetworkTxItem, type ChainAccount,
} from '../services/shardora'

// ─── state ────────────────────────────────────────────────────────────────────
const query = ref('')
const selectedShard = ref<number | 'auto'>('auto')
const loading = ref(false)
const error = ref('')

const shardStatuses = ref<ShardStatus[]>([])
const networkOnline = ref(false)
const networkChecked = ref(false)
const checkingStatus = ref(false)

const genesisBalances = ref(GENESIS_ACCOUNTS.map(g => ({ ...g, balance: null as string | null, loading: false })))

const viewShard = ref(3)
const viewPool = ref<number | null>(null)
const poolList = ref<Array<{ idx: number; height: string; syncedHeight: string }>>([])
const poolsLoading = ref(false)
const latestBlocks = ref<any[]>([])
const networkTxs = ref<NetworkTxItem[]>([])
const blocksLoading = ref(false)
const activityLoading = ref(false)

const blockDetailVisible = ref(false)
const selectedBlock = ref<any>(null)

// Block transaction list (async-loaded when block detail opens)
interface BlockTxRow {
    txIndex: number
    txItem: TxItem | null
    addresses: any[]
    kvChanges: any[]
}
const blockTxList = ref<BlockTxRow[]>([])
const blockTxLoading = ref(false)

// Unified transaction detail drawer
const txDetailDrawerVisible = ref(false)
const selectedTxGroup = ref<any>(null)   // addressArray group (from block context)
const selectedTxItem = ref<TxItem | null>(null)  // from query_account_txs
const txEnrichLoading = ref(false)

// Chain address list (from /explorer/addresses SQLite)
const chainAddresses = ref<ChainAccount[]>([])
const addrListLoading = ref(false)
const addrListHasMore = ref(false)
const addrListCursor = ref(0)          // next_cursor from last response
const addrCursorStack = ref<number[]>([])  // stack of cursors for prev-page
const addrListLimit = 50
const addrFilter = ref('')
const filteredChainAddresses = computed(() => {
    if (!addrFilter.value) return chainAddresses.value
    const f = addrFilter.value.toLowerCase()
    return chainAddresses.value.filter(r => r.address.includes(f))
})

// Address tx drawer
const addrTxDrawerVisible = ref(false)
const addrTxAddr = ref('')
const addrTxShard = ref(0)
const addrTxList = ref<TxItem[]>([])
const addrTxLoading = ref(false)
const addrTxOffset = ref(0)
const addrTxLimit = 20

const searchMode = ref<'none' | 'address' | 'block' | 'tx'>('none')

// Smart contracts list
const contractsList = ref<any[]>([])
const contractsLoading = ref(false)
const contractsHasMore = ref(false)
const contractsCursor = ref(0)
const contractsCursorStack = ref<number[]>([])
const contractsLimit = 20

// Contract detail drawer
const contractDetailVisible = ref(false)
const contractDetail = ref<any>(null)
const contractTxsList = ref<any[]>([])
const contractTxsLoading = ref(false)
const contractTxsOffset = ref(0)
const contractTxsLimit = 20

let autoRefreshTimer: ReturnType<typeof setInterval> | null = null

// ─── helpers ──────────────────────────────────────────────────────────────────
function shortAddr(addr: string): string {
    if (!addr || addr.length <= 14) return addr || ''
    return addr.slice(0, 8) + '…' + addr.slice(-6)
}

function fmtTs(ts: string | undefined): string {
    if (!ts) return '—'
    const ms = parseInt(ts)
    if (!ms) return '—'
    return new Date(ms).toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
}

function b64ToAddrLocal(b64: string): string {
    if (!b64) return ''
    try {
        const bin = atob(b64)
        const bytes = Array.from(bin, (c: string) => c.charCodeAt(0))
        return bytes.slice(-20).map((n: number) => n.toString(16).padStart(2, '0')).join('')
    } catch {
        return ''
    }
}

function b64ToHex(b64: string | undefined): string {
    if (!b64) return ''
    try {
        const bin = atob(b64)
        return Array.from(bin, (c: string) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    } catch {
        return b64
    }
}

function getBlockAddrsLocal(block: any): any[] {
    return block?.addressArray ?? block?.blockInfo?.addressArray ?? []
}

function getBlockKVLocal(block: any): any[] {
    return block?.keyValueArray ?? block?.blockInfo?.keyValueArray ?? []
}

interface TxGroup {
    txIndex: number
    addresses: any[]
    kvChanges: any[]
}

function groupedTxs(block: any): TxGroup[] {
    if (!block) return []
    const addrs = getBlockAddrsLocal(block)
    const kvs = getBlockKVLocal(block)
    const map = new Map<number, TxGroup>()
    for (const a of addrs) {
        const idx = typeof a.txIndex === 'number' ? a.txIndex : (parseInt(a.txIndex ?? '0') || 0)
        if (!map.has(idx)) map.set(idx, { txIndex: idx, addresses: [], kvChanges: [] })
        map.get(idx)!.addresses.push(a)
    }
    for (const kv of kvs) {
        const kvAddr = b64ToAddrLocal(kv.addr ?? '')
        for (const g of map.values()) {
            if (g.addresses.some((a: any) => b64ToAddrLocal(a.addr) === kvAddr)) {
                g.kvChanges.push(kv)
                break
            }
        }
    }
    return Array.from(map.values()).sort((a, b) => a.txIndex - b.txIndex)
}

// ─── data loaders ─────────────────────────────────────────────────────────────
async function checkStatus() {
    checkingStatus.value = true
    const statuses = await checkNetworkStatus()
    shardStatuses.value = statuses
    networkOnline.value = statuses.some(s => s.online)
    networkChecked.value = true
    checkingStatus.value = false
}

async function loadGenesisBalances() {
    for (const item of genesisBalances.value) {
        item.loading = true
        const acc = await queryAccountOnShard(item.address, item.shard)
        item.balance = acc ? acc.balance : null
        item.loading = false
    }
}

async function loadPools() {
    poolsLoading.value = true
    const info = await getLatestPoolInfo(viewShard.value)
    if (info?.pools) {
        poolList.value = info.pools
            .map((p: any, idx: number) => ({ ...p, idx }))
            .filter((p: any) => parseInt(p.height) > 0)
            .sort((a: any, b: any) => a.idx - b.idx)
    } else {
        poolList.value = []
    }
    poolsLoading.value = false
}

async function loadLatestBlocks() {
    blocksLoading.value = true
    if (viewPool.value === null) {
        const blocks = await getLatestNetworkBlocks(viewShard.value, 15)
        latestBlocks.value = blocks.map(b => ({ ...b }))
    } else {
        const poolInfo = poolList.value.find(p => p.idx === viewPool.value)
        if (!poolInfo) { latestBlocks.value = []; blocksLoading.value = false; return }
        const h = parseInt(poolInfo.height)
        const start = Math.max(1, h - 14)
        const res = await getBlocks(viewShard.value, viewPool.value, start, 15)
        latestBlocks.value = (res?.blocks ?? [])
            .filter((b: any) => b.blockInfo)
            .map((b: any) => ({ ...b, poolIndex: viewPool.value, shardId: viewShard.value }))
            .reverse()
    }
    blocksLoading.value = false
}

async function loadNetworkActivity() {
    activityLoading.value = true
    if (viewPool.value === null) {
        networkTxs.value = await getNetworkTransactions(viewShard.value, 40)
    } else {
        networkTxs.value = extractTxsFromBlocks(latestBlocks.value).slice(0, 40)
    }
    activityLoading.value = false
}

function extractTxsFromBlocks(blocks: any[]): NetworkTxItem[] {
    const items: NetworkTxItem[] = []
    for (const block of blocks) {
        const bi = block.blockInfo
        const addrs = getBlockAddrsLocal(block)
        const kvs = getBlockKVLocal(block)
        const map = new Map<number, NetworkTxItem>()
        for (const a of addrs) {
            const addr = b64ToAddrLocal(a.addr ?? '')
            if (!addr || addr === '0'.repeat(40)) continue
            const idx = typeof a.txIndex === 'number' ? a.txIndex : (parseInt(a.txIndex ?? '0') || 0)
            if (!map.has(idx)) {
                map.set(idx, {
                    height: bi?.height ?? '0',
                    poolIndex: block.poolIndex ?? viewPool.value ?? 0,
                    shardId: block.shardId ?? viewShard.value,
                    timestamp: bi?.timestamp ?? '0',
                    txIndex: idx,
                    addrCount: 0,
                    addresses: [],
                    kvChanges: [],
                    blockRef: block,
                })
            }
            const item = map.get(idx)!
            item.addresses.push(a)
            item.addrCount++
        }
        for (const kv of kvs) {
            const kvAddr = b64ToAddrLocal(kv.addr ?? '')
            for (const item of map.values()) {
                if (item.addresses.some((a: any) => b64ToAddrLocal(a.addr) === kvAddr)) {
                    item.kvChanges.push(kv)
                    break
                }
            }
        }
        items.push(...map.values())
    }
    return items.sort((a, b) => parseInt(b.height) - parseInt(a.height) || b.txIndex - a.txIndex)
}

async function onViewShardChange() {
    viewPool.value = null
    latestBlocks.value = []
    networkTxs.value = []
    addrCursorStack.value = []
    await loadPools()
    await loadLatestBlocks()
    loadNetworkActivity()
    loadChainAddresses(0)
}

async function onViewPoolChange() {
    latestBlocks.value = []
    networkTxs.value = []
    addrCursorStack.value = []
    await loadLatestBlocks()
    loadNetworkActivity()
    loadChainAddresses(0)
}

function refreshAll() {
    checkStatus()
    loadPools()
    loadLatestBlocks()
    loadNetworkActivity()
}

onMounted(() => {
    checkStatus()
    loadGenesisBalances()
    loadPools()
    loadLatestBlocks()
    loadNetworkActivity()
    loadChainAddresses(0)
    loadContracts(0)
    autoRefreshTimer = setInterval(async () => {
        if (searchMode.value === 'none') {
            await loadLatestBlocks()
            loadNetworkActivity()
        }
        loadChainAddresses(0)
        loadContracts(0)
    }, 30000)
})
onUnmounted(() => { if (autoRefreshTimer) clearInterval(autoRefreshTimer) })

// ─── block detail ──────────────────────────────────────────────────────────────
function openBlockDetail(row: any) {
    selectedBlock.value = row
    blockTxList.value = []
    blockDetailVisible.value = true
    loadBlockTransactions(row)  // async, non-blocking
}

function normalizeExplorerTx(t: any): TxItem {
    return {
        height:     String(t.height ?? 0),
        txIndex:    t.tx_index ?? 0,
        nonce:      String(t.nonce ?? 0),
        from:       (t.from_addr ?? '').replace(/^0x/, ''),
        to:         (t.to_addr   ?? '').replace(/^0x/, ''),
        amount:     String(t.amount ?? 0),
        gasLimit:   String(t.gas_limit ?? 0),
        gasUsed:    String(t.gas_used  ?? 0),
        gasPrice:   String(t.gas_price ?? 0),
        balance:    '',
        step:       t.step_type ?? 0,
        status:     t.status    ?? 0,
        txHash:     t.tx_hash   ?? '',
        uniqueHash: t.tx_hash   ?? '',
        shard:      t.shard_id  ?? viewShard.value,
    }
}

function normalizeExplorerBlock(b: any): any {
    return {
        blockInfo: {
            height:    String(b.height),
            timestamp: String(b.timestamp),
            allGas:    String(b.all_gas ?? 0),
        },
        poolIndex: b.pool_index,
        shardId:   b.shard_id,
        qc: {
            leaderIdx:   b.leader_idx,
            networkId:   b.shard_id,
            electHeight: String(b.elect_height ?? 0),
            poolIndex:   b.pool_index,
        },
        parentHash:   null,
        addressArray: [],
        keyValueArray: [],
        _addrCount:   b.tx_count ?? 0,
        _explorerTxs: b.transactions ?? [],
    }
}

async function loadBlockTransactions(block: any) {
    // Explorer block — tx list already embedded
    if (Array.isArray(block._explorerTxs) && block._explorerTxs.length > 0) {
        blockTxList.value = block._explorerTxs.map((t: any, i: number) => ({
            txIndex:   i,
            txItem:    normalizeExplorerTx(t),
            addresses: [],
            kvChanges: [],
        }))
        return
    }

    const groups = groupedTxs(block)
    if (groups.length === 0) return
    blockTxLoading.value = true
    const height = block.blockInfo?.height
    const shardId = block.shardId ?? viewShard.value
    // Pre-fill with address-only data so table renders immediately
    blockTxList.value = groups.map(g => ({ txIndex: g.txIndex, txItem: null, addresses: g.addresses, kvChanges: g.kvChanges }))
    // Async enrich each row with query_account_txs
    for (let i = 0; i < groups.length; i++) {
        const group = groups[i]
        for (const a of group.addresses) {
            const addr = b64ToAddrLocal(a.addr ?? '')
            if (!addr) continue
            try {
                const res = await queryAccountTxsOnShard(addr, shardId, 50, 0)
                if (!res?.transactions?.length) continue
                const found = res.transactions.find((t: TxItem) => String(t.height) === String(height))
                if (found) {
                    blockTxList.value[i] = { ...blockTxList.value[i], txItem: found }
                    break
                }
            } catch { /* ignore */ }
        }
    }
    blockTxLoading.value = false
}

function openBlockTxDetail(row: BlockTxRow) {
    selectedTxItem.value = row.txItem
    selectedTxGroup.value = { txIndex: row.txIndex, addresses: row.addresses, kvChanges: row.kvChanges }
    txDetailDrawerVisible.value = true
}

// ─── open tx drawer from network tx list ──────────────────────────────────────
async function openNetworkTxDrawer(item: NetworkTxItem) {
    // Wrap the networkTxItem's data into the same shape openTxGroupDrawer expects
    selectedBlock.value = item.blockRef
    const group = { txIndex: item.txIndex, addresses: item.addresses, kvChanges: item.kvChanges }
    await openTxGroupDrawer(group)
}

// ─── open tx detail drawer (from network tx list — needs enrichment) ──────────
async function openTxGroupDrawer(txGroup: TxGroup) {
    selectedTxGroup.value = txGroup
    selectedTxItem.value = null
    txDetailDrawerVisible.value = true
    const height = selectedBlock.value?.blockInfo?.height
    const shardId = selectedBlock.value?.shardId ?? viewShard.value
    txEnrichLoading.value = true
    try {
        for (const a of txGroup.addresses) {
            const addr = b64ToAddrLocal(a.addr ?? '')
            if (!addr) continue
            const res = await queryAccountTxsOnShard(addr, shardId, 50, 0)
            if (!res?.transactions?.length) continue
            const found = res.transactions.find((t: TxItem) => String(t.height) === String(height))
            if (found) { selectedTxItem.value = found; break }
        }
    } finally {
        txEnrichLoading.value = false
    }
}

// ─── open tx detail drawer (from account tx list) ─────────────────────────────
function openAcctTxDetail(txItem: TxItem) {
    selectedTxItem.value = txItem
    selectedTxGroup.value = null
    txDetailDrawerVisible.value = true
}

function viewBlockAddr(addr: string) {
    if (!addr || addr.length !== 40) return
    blockDetailVisible.value = false
    fillSearch(addr)
}

function viewAddrFromDrawer(addr: string) {
    if (!addr || addr.length !== 40) return
    txDetailDrawerVisible.value = false
    blockDetailVisible.value = false
    addrTxDrawerVisible.value = false
    fillSearch(addr)
}

// ─── chain address list (from /explorer/addresses SQLite, cursor-based) ──────
async function loadChainAddresses(beforeId = 0) {
    addrListLoading.value = true
    const pool = viewPool.value ?? undefined
    const res = await getAllAccounts(viewShard.value, pool, addrListLimit, beforeId)
    if (res) {
        chainAddresses.value = res.accounts
        addrListHasMore.value = res.has_more ?? false
        addrListCursor.value = res.next_cursor ?? 0
    } else {
        chainAddresses.value = []
        addrListHasMore.value = false
        addrListCursor.value = 0
    }
    addrListLoading.value = false
}

function addrListPrevPage() {
    if (addrCursorStack.value.length === 0) return
    const prev = addrCursorStack.value.pop()!
    loadChainAddresses(prev)
}
function addrListNextPage() {
    if (!addrListHasMore.value) return
    addrCursorStack.value.push(addrListCursor.value === 0 ? 0 : (chainAddresses.value[0]?._id ?? 0) + 1)
    loadChainAddresses(addrListCursor.value)
}
// ─── contracts list ───────────────────────────────────────────────────────────
async function loadContracts(beforeId = 0) {
    contractsLoading.value = true
    try {
        const params: Record<string, any> = { limit: contractsLimit }
        if (beforeId > 0) params.before_id = beforeId
        const resp = await explorerGetContracts(viewShard.value, params)
        const items: any[] = resp?.items ?? resp?.data?.items ?? []
        contractsList.value = items.length > contractsLimit ? items.slice(0, contractsLimit) : items
        contractsHasMore.value = resp?.has_more ?? resp?.data?.has_more ?? false
        contractsCursor.value = resp?.next_cursor ?? resp?.data?.next_cursor ?? 0
    } catch (_) {
        contractsList.value = []
    } finally {
        contractsLoading.value = false
    }
}

function contractsPrevPage() {
    if (contractsCursorStack.value.length === 0) return
    const prev = contractsCursorStack.value.pop()!
    loadContracts(prev)
}

function contractsNextPage() {
    if (!contractsHasMore.value) return
    contractsCursorStack.value.push(contractsCursor.value === 0 ? 0 : (contractsList.value[0]?.id ?? 0) + 1)
    loadContracts(contractsCursor.value)
}

// ─── contract detail drawer ───────────────────────────────────────────────────
function formatAbiJson(abi: string): string {
    try {
        return JSON.stringify(JSON.parse(abi), null, 2)
    } catch {
        return abi
    }
}

async function openContractDetail(row: any) {
    contractDetail.value = row
    contractDetailVisible.value = true
    contractTxsOffset.value = 0
    await loadContractTxs()
}

async function loadContractTxs() {
    if (!contractDetail.value) return
    contractTxsLoading.value = true
    try {
        const beforeId = contractTxsOffset.value > 0 ? contractTxsOffset.value : undefined
        const resp = await explorerGetContractTxs(viewShard.value, contractDetail.value.addr, beforeId, contractTxsLimit)
        contractTxsList.value = resp?.items ?? resp?.data?.items ?? []
    } catch (_) {
        contractTxsList.value = []
    } finally {
        contractTxsLoading.value = false
    }
}

function contractTxsPrevPage() {
    if (contractTxsOffset.value === 0) return
    contractTxsOffset.value = Math.max(0, contractTxsOffset.value - contractTxsLimit)
    loadContractTxs()
}

function contractTxsNextPage() {
    if (contractTxsList.value.length < contractTxsLimit) return
    const last = contractTxsList.value[contractTxsList.value.length - 1]
    contractTxsOffset.value = last?.id ?? (contractTxsOffset.value + contractTxsLimit)
    loadContractTxs()
}

// ─── address tx drawer ────────────────────────────────────────────────────────
async function openAddrTxDrawer(addr: string, shard: number) {
    addrTxAddr.value = addr
    addrTxShard.value = shard
    addrTxOffset.value = 0
    addrTxList.value = []
    addrTxDrawerVisible.value = true
    addrTxLoading.value = true
    try {
        const res = await queryAccountTxsOnShard(addr, shard, addrTxLimit, 0)
        addrTxList.value = res?.status === 0 ? (res.transactions ?? []) : []
    } finally {
        addrTxLoading.value = false
    }
}
async function addrTxPrevPage() {
    addrTxOffset.value = Math.max(0, addrTxOffset.value - addrTxLimit)
    addrTxLoading.value = true
    try {
        const res = await queryAccountTxsOnShard(addrTxAddr.value, addrTxShard.value, addrTxLimit, addrTxOffset.value)
        addrTxList.value = res?.status === 0 ? (res.transactions ?? []) : []
    } finally {
        addrTxLoading.value = false
    }
}
async function addrTxNextPage() {
    addrTxOffset.value += addrTxLimit
    addrTxLoading.value = true
    try {
        const res = await queryAccountTxsOnShard(addrTxAddr.value, addrTxShard.value, addrTxLimit, addrTxOffset.value)
        addrTxList.value = res?.status === 0 ? (res.transactions ?? []) : []
    } finally {
        addrTxLoading.value = false
    }
}

// ─── search ───────────────────────────────────────────────────────────────────
function fillSearch(addr: string) {
    query.value = addr
    search()
}

function clearSearch() {
    query.value = ''
    if (searchMode.value !== 'none') {
        searchMode.value = 'none'
        loadLatestBlocks()
        loadNetworkActivity()
        loadChainAddresses(0)
    }
}

async function search() {
    const q = query.value.trim().toLowerCase().replace(/^0x/, '')
    if (!q) return
    if (!/^[0-9a-f]+$/.test(q)) { error.value = '请输入十六进制地址或哈希'; return }
    error.value = ''
    loading.value = true
    try {
        if (q.length === 40) {
            // ── Address → 填入地址列表 ────────────────────────────────
            const acc = selectedShard.value === 'auto'
                ? await queryAccount(q)
                : await queryAccountOnShard(q, selectedShard.value as number)
            if (!acc) { error.value = `地址 ${q} 未找到`; return }
            searchMode.value = 'address'
            latestBlocks.value = []
            networkTxs.value = []
            chainAddresses.value = [{
                address:     q,
                balance:     String(acc.balance ?? 0),
                nonce:       String(acc.nonce   ?? 0),
                sharding_id: acc.shard,
                pool_index:  acc.pool_index ?? 0,
                type:        0,
                latest_height: '0',
                tx_count:    0,
            }]
            addrListHasMore.value = false
        } else if (q.length === 64) {
            // ── Block hash or Tx hash ─────────────────────────────────
            const hash = '0x' + q
            const shardsToTry = selectedShard.value === 'auto'
                ? [viewShard.value, ...SHARDS.filter(s => s !== viewShard.value)]
                : [selectedShard.value as number]

            // Try block hash first
            for (const shard of shardsToTry) {
                const b = await explorerGetBlock(hash, shard)
                if (b) {
                    searchMode.value = 'block'
                    const normalized = normalizeExplorerBlock(b)
                    latestBlocks.value = [normalized]
                    networkTxs.value = []
                    chainAddresses.value = []
                    viewShard.value = b.shard_id
                    openBlockDetail(normalized)
                    return
                }
            }
            // Try tx hash
            for (const shard of shardsToTry) {
                const t = await explorerGetTx(hash, shard)
                if (t) {
                    searchMode.value = 'tx'
                    const txItem = normalizeExplorerTx(t)
                    latestBlocks.value = []
                    chainAddresses.value = []
                    networkTxs.value = [{
                        height:    String(t.height),
                        poolIndex: t.pool_index,
                        shardId:   t.shard_id,
                        timestamp: String(t.timestamp),
                        txIndex:   0,
                        addrCount: 1,
                        addresses: [],
                        kvChanges: [],
                        blockRef:  null,
                    }]
                    viewShard.value = t.shard_id
                    openAcctTxDetail(txItem)
                    return
                }
            }
            error.value = `未找到区块或交易: ${q}`
        } else {
            error.value = '请输入 40 位地址或 64 位区块/交易哈希'
        }
    } catch (e: any) {
        error.value = '查询失败: ' + (e?.message ?? String(e))
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
.explorer-container { display:flex; justify-content:center; padding:24px; }
.explorer-card { width:100%; max-width:1200px; margin-top:16px; }
.card-header { display:flex; align-items:center; gap:10px; }
.title { font-size:18px; font-weight:600; }
.shard-status-row { display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-bottom:4px; }
.shard-view-row { display:flex; align-items:center; gap:10px; margin:10px 0 4px; }
.shard-view-label { font-size:13px; color:var(--el-text-color-secondary); white-space:nowrap; }
.section-header {
    display:flex; align-items:center; justify-content:space-between;
    font-size:13px; font-weight:600;
    border-left:3px solid var(--el-color-primary); padding-left:8px; margin:10px 0 6px;
}
.section { margin-top:4px; }
.dlg-section-title { font-size:13px; font-weight:600; color:var(--el-text-color-primary); margin:0 0 6px; }
.mono { font-family:monospace; font-size:12px; }
.addr-full { word-break:break-all; }
.addr-cell { cursor:pointer; color:var(--el-color-primary); }
.addr-cell:hover { text-decoration:underline; }
.link-text { color:var(--el-color-primary); cursor:pointer; font-weight:600; }
.no-data { color:var(--el-text-color-secondary); font-size:13px; padding:16px 0; text-align:center; }
.pagination-row { display:flex; align-items:center; gap:12px; padding:12px 0; }
.page-info { font-size:13px; color:var(--el-text-color-regular); }
.text-muted { color:var(--el-text-color-secondary); font-size:12px; }
</style>
