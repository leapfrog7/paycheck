import { useEffect, useState } from 'react'
import { readStorage, storageKeys, writeStorage } from '../storage'

export function useLocalPayroll(initialValue = []) {
  const [data, setData] = useState(() => readStorage(storageKeys.payroll, initialValue))

  useEffect(() => {
    writeStorage(storageKeys.payroll, data)
  }, [data])

  return [data, setData]
}
