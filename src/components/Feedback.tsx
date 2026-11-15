import { useEffect, useRef, useState, type FormEvent } from 'react'

/** Formspree form owned by the author; submissions are emailed to them. */
export const FEEDBACK_ENDPOINT = 'https://formspree.io/f/xbgodnwd'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const first = useRef<HTMLTextAreaElement>(null)
  useEffect(() => first.current?.focus(), [])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    if (!String(form.get('message') ?? '').trim()) return
    setStatus('sending')
    try {
      const res = await fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: form,
      })
      if (res.ok) setStatus('sent')
      else {
        const body = await res.json().catch(() => null)
        setError(body?.errors?.map((x: { message: string }) => x.message).join(' ') || `Formspree returned ${res.status}.`)
        setStatus('error')
      }
    } catch {
      setError('Network error. Check your connection and try again.')
      setStatus('error')
    }
  }

  const field = 'w-full rounded-lg border border-line-strong bg-bg px-3 py-2 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-scrim md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fb-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl border border-line bg-surface p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] md:max-w-md md:rounded-2xl md:pb-5"
      >
        {status === 'sent' ? (
          <div className="py-6 text-center">
            <h2 id="fb-title" className="text-[17px] font-semibold">
              Thank you
            </h2>
            <p className="mt-1 text-[13px] text-muted">Your feedback is on its way. I read every note.</p>
            <button type="button" onClick={onClose} className="mt-5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-on-accent">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <h2 id="fb-title" className="text-[17px] font-semibold">
                Feedback
              </h2>
              <p className="mt-0.5 text-[13px] text-muted">I&rsquo;m always learning: what&rsquo;s wrong, missing or confusing?</p>
            </div>
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted">Message</span>
              <textarea ref={first} name="message" required rows={5} className={`${field} resize-y`} placeholder="Your thoughts…" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[12px] text-muted">Name (optional)</span>
                <input name="name" autoComplete="name" className={field} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] text-muted">Email (optional, for a reply)</span>
                <input name="email" type="email" autoComplete="email" className={field} />
              </label>
            </div>
            {/* Spam trap: humans never fill this */}
            <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <input type="hidden" name="_subject" value="Pipe Dreams feedback" />
            <input type="hidden" name="page" value={typeof window !== 'undefined' ? window.location.href : ''} />
            {status === 'error' && (
              <p role="alert" className="text-[13px] text-down">
                Couldn&rsquo;t send: {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-[13px] font-medium text-muted hover:bg-sunken hover:text-fg">
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === 'sending'}
                className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-on-accent disabled:opacity-60"
              >
                {status === 'sending' ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
