import Modal from './Modal/Modal'
import { Button } from './index'
interface DraftRecoveryProps { available: boolean; dirty: boolean; storageError: boolean; onResume: () => void; onDiscard: () => void; closing?: boolean; onConfirmClose?: () => void; onCancelClose?: () => void }
export default function DraftRecovery({available, dirty, storageError, onResume, onDiscard, closing, onConfirmClose, onCancelClose}: DraftRecoveryProps) {
  return <>
    {(available || dirty) && <div className="rounded-lg border border-line bg-panel-2 p-3 text-sm" role="status">
      {available ? <><p>A previous unsaved draft is available on this device.</p><div className="mt-2 flex flex-wrap gap-4"><button className="text-accent font-semibold" onClick={onResume} type="button">Resume draft</button><button className="text-muted" onClick={onDiscard} type="button">Discard previous draft</button></div></>
        : storageError ? 'Draft recovery unavailable: save before leaving.' : 'Draft saved on this device. It has not been published.'}
    </div>}
    {closing && <Modal isOpen title="Leave this unsaved form?" onClose={()=>onCancelClose?.()} footer={<><Button variant="outline" onClick={onCancelClose}>Keep editing</Button><Button onClick={onConfirmClose}>Leave form</Button></>}><p>{storageError ? 'Your draft could not be saved on this device. Leaving may lose your changes.' : 'Your draft stays on this device for recovery. Server records have not changed.'}</p></Modal>}
  </>
}
