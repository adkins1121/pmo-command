import type { PmoData } from '../data/types'
import { getDefaults } from '../data/defaults'
import { migrate, normalize } from '../data/normalize'

export function exportJson(data: PmoData) {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'amdg-pmo.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    /* ignore */
  }
}

export function readImportFile(file: File): Promise<PmoData> {
  return new Promise((resolve, reject) => {
    const rd = new FileReader()
    rd.onload = () => {
      try {
        resolve(migrate(JSON.parse(rd.result as string)))
      } catch (err) {
        reject(err)
      }
    }
    rd.onerror = () => reject(rd.error)
    rd.readAsText(file)
  })
}

export function freshDefaults(): PmoData {
  return normalize(getDefaults())
}
