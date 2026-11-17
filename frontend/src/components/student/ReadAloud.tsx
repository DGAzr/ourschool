import { useEffect, useState } from 'react'
import { Button } from '../ui'

export default function ReadAloud({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel() }, [supported, text])
  if (!supported) return null
  const stop = () => { window.speechSynthesis.cancel(); setSpeaking(false); setPaused(false) }
  const read = () => {
    stop()
    const utterance = new SpeechSynthesisUtterance(text.replace(/[#*_`]/g, ''))
    utterance.onend = utterance.onerror = () => { setSpeaking(false); setPaused(false) }
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }
  return <div className="flex flex-wrap gap-2">
    {!speaking ? <Button variant="outline" onClick={read}>Read aloud</Button> : <>
      <Button variant="outline" onClick={() => {
        if (paused) window.speechSynthesis.resume()
        else window.speechSynthesis.pause()
        setPaused(!paused)
      }}>{paused ? 'Resume reading' : 'Pause reading'}</Button>
      <Button variant="secondary" onClick={stop}>Stop reading</Button>
    </>}
  </div>
}
