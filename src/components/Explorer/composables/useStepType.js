export const STEP_TYPE_MAP = {
  0:  { label: 'Transfer',       tagType: 'primary',   isSystem: false },
  1:  { label: 'NormalTo',       tagType: 'info',      isSystem: true  },
  2:  { label: 'Elect',          tagType: 'warning',   isSystem: true  },
  3:  { label: 'TimeBlock',      tagType: 'info',      isSystem: true  },
  4:  { label: 'Genesis',        tagType: 'info',      isSystem: true  },
  5:  { label: 'LocalTos',       tagType: 'info',      isSystem: true  },
  6:  { label: 'CreateContract', tagType: 'success',   isSystem: false },
  7:  { label: 'CallContract',   tagType: 'warning',   isSystem: false },
  8:  { label: 'GasPrefund',     tagType: '',          isSystem: false },
  9:  { label: 'CreateAddr',     tagType: 'info',      isSystem: true  },
  10: { label: 'Refund',         tagType: '',          isSystem: false },
  11: { label: 'JoinElect',      tagType: 'primary',   isSystem: false },
  12: { label: 'Statistic',      tagType: 'info',      isSystem: true  },
  13: { label: 'Library',        tagType: 'success',   isSystem: false },
  15: { label: 'Cross',          tagType: 'info',      isSystem: true  },
  16: { label: 'RootCross',      tagType: 'info',      isSystem: true  },
  17: { label: 'PoolStat',       tagType: 'info',      isSystem: true  },
  19: { label: 'CloneDeploy',    tagType: 'warning',   isSystem: true  },
}

export function useStepType(stepType) {
  return STEP_TYPE_MAP[stepType] || { label: `Type${stepType}`, tagType: '', isSystem: false }
}
