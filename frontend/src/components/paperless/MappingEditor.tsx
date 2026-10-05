import { useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button, Select } from '../ui'

interface MappingRow {
  id: number
  name: string
  target: string
  configured: boolean
  inScope: boolean
  color?: string
}

interface MappingEditorProps {
  rows: MappingRow[]
  sourceLabel: string
  targetLabel: string
  targets: { value: string; label: string }[]
  optionsReady: boolean
  disabled: boolean
  scopeError?: string | null
  onSave: (id: number, target: string) => Promise<void>
  onRemove: (id: number) => Promise<void>
}

export default function MappingEditor({
  rows, sourceLabel, targetLabel, targets, optionsReady, disabled,
  scopeError, onSave, onRemove,
}: MappingEditorProps) {
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [saving, setSaving] = useState(false)
  const saveLock = useRef(false)
  const configured = rows.filter(row => row.configured)
  const available = optionsReady
    ? rows.filter(row => row.inScope && !row.configured)
    : []
  const selected = available.find(row => String(row.id) === source)
  const busy = disabled || saving

  const runAction = async (action: () => Promise<void>) => {
    if (saveLock.current || disabled) return false
    saveLock.current = true
    setSaving(true)
    try {
      await action()
      return true
    } catch {
      // The parent reports the failure; keep draft selections for retry.
      return false
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }

  const addMapping = async () => {
    if (!selected || !targets.some(option => option.value === target)) return
    if (await runAction(() => onSave(selected.id, target))) {
      setSource('')
      setTarget('')
    }
  }

  return (
    <div className="space-y-4">
      {!optionsReady && (
        <p role="status" className="text-[13px] text-muted">
          {scopeError
            ? 'The scope sync failed. Use Sync now to refresh mapping choices.'
            : 'Mapping choices need a successful sync of the current scope. Use Sync now or wait for the queued sync.'}
        </p>
      )}
      {configured.length === 0 ? (
        <p className="text-[13px] text-faint">
          No mappings added. Automatic classification still applies.
        </p>
      ) : (
        <div className="space-y-3">
          {configured.map(row => (
            <div key={row.id} className="flex flex-wrap items-center gap-3">
              <span className="max-w-full break-words text-[13px] font-semibold" style={{ color: row.color }}>
                {row.name}
              </span>
              {optionsReady && !row.inScope && (
                <span className="text-[12px] text-muted">Outside Sync Scope</span>
              )}
              <ArrowRight size={13} className="shrink-0 text-faintest" aria-hidden="true" />
              <div className="w-44 max-w-full">
                <Select
                  aria-label={`${targetLabel} for ${row.name}`}
                  value={row.target}
                  onChange={event => {
                    const value = event.target.value
                    void runAction(() => onSave(row.id, value))
                  }}
                  disabled={busy || !optionsReady || !row.inScope}
                  options={targets}
                />
              </div>
              <Button
                variant="secondary" size="sm" disabled={busy}
                aria-label={`Remove mapping for ${row.name}`}
                onClick={() => void runAction(() => onRemove(row.id))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
      {optionsReady && available.length === 0 ? (
        <p className="text-[13px] text-faint">
          No additional {sourceLabel.toLowerCase()} choices in Sync Scope.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-52 max-w-full">
            <Select
              label={`${sourceLabel} from Sync Scope`}
              value={selected ? source : ''}
              disabled={busy || !optionsReady || !available.length}
              onChange={event => {
                setSource(event.target.value)
                setTarget(available.find(row => String(row.id) === event.target.value)?.target ?? '')
              }}
              options={[
                { value: '', label: `Choose ${sourceLabel.toLowerCase()}` },
                ...available.map(row => ({ value: String(row.id), label: row.name })),
              ]}
            />
          </div>
          <div className="w-44 max-w-full">
            <Select
              label={targetLabel} value={target}
              disabled={busy || !selected}
              onChange={event => setTarget(event.target.value)}
              options={targets}
            />
          </div>
          <Button
            variant="secondary" disabled={busy || !selected}
            onClick={() => void addMapping()}
          >
            Add mapping
          </Button>
        </div>
      )}
    </div>
  )
}
