import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, ArrowUpRight, AudioLines, CalendarDays, Check, CircleHelp,
  Clock3, Command, LayoutDashboard, LogOut, Menu, Mic, Phone, Plus, MessageCircle,
  Search, Settings, ShieldCheck, Sparkles, Users, X, LoaderCircle
} from 'lucide-react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth'
import { auth, isFirebaseConfigured } from './firebase'
import { createVapiClient, isVapiConfigured, vapiAssistantId } from './vapi'
import { api } from './api'

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Leads', icon: Users },
  { label: 'Call history', icon: Phone },
  { label: 'Voice agent', icon: AudioLines },
]

function Login({ onLogin, onGoogleLogin, busy, error }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  return <div className="grid min-h-screen place-items-center bg-paper p-5"><div className="brutal-card w-full max-w-md p-7">
    <div className="mb-6 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center border-2 border-ink bg-signal"><Command/></div><div><h1 className="font-display text-2xl font-bold">MAHIMA<span className="text-coral">.AI</span></h1><p className="eyebrow">Team workspace</p></div></div>
    <h2 className="font-display text-2xl font-bold">Sign in</h2><p className="mt-2 text-sm text-zinc-500">Use your approved Google account or admin email and password.</p>
    <button type="button" className="secondary-button mt-6 w-full justify-center" onClick={onGoogleLogin} disabled={busy}><span className="text-base font-black">G</span> Continue with Google</button>
    <div className="my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400"><span className="h-px flex-1 bg-zinc-200"/>Or admin email sign-in<span className="h-px flex-1 bg-zinc-200"/></div>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); onLogin(email, password) }}>
      <label className="block text-xs font-bold">Email<input className="brutal-input mt-2 w-full" type="email" required value={email} onChange={e => setEmail(e.target.value)}/></label>
      <label className="block text-xs font-bold">Password<input className="brutal-input mt-2 w-full" type="password" required value={password} onChange={e => setPassword(e.target.value)}/></label>
      {error && <p className="border-2 border-ink bg-coral p-3 text-xs font-bold">{error}</p>}
      <button className="primary-button w-full justify-center" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowUpRight size={15}/></button>
    </form>
  </div></div>
}

function StatCard({ label, value, note, icon: Icon, color }) {
  return <div className="brutal-card p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-zinc-500">{label}</p><p className="mt-3 font-display text-4xl font-bold">{value}</p></div><div className={`grid h-11 w-11 place-items-center border-2 border-ink ${color}`}><Icon size={21}/></div></div><p className="mt-5 text-xs font-semibold text-zinc-500">{note}</p></div>
}

function Interest({ value }) {
  const v = String(value || 'Unknown').toLowerCase()
  const cls = v.includes('hot') ? 'bg-coral' : v.includes('warm') ? 'bg-signal' : v.includes('cold') ? 'bg-sky' : 'bg-zinc-200'
  return <span className={`inline-flex border border-ink px-2 py-1 text-[10px] font-bold uppercase ${cls}`}>{value || 'Unknown'}</span>
}

function LeadTable({ leads }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead className="bg-[#f0efe8] text-[10px] font-bold uppercase tracking-widest text-zinc-500"><tr>{['Customer','Phone','Requirement','Interest','Status'].map(x => <th key={x} className="px-5 py-3">{x}</th>)}</tr></thead><tbody>{leads.map(lead => <tr key={lead.id} className="border-t border-zinc-200 text-xs"><td className="px-5 py-4"><p className="font-bold">{lead.name}</p><p className="mt-1 text-[10px] text-zinc-500">{lead.id}</p></td><td className="px-5 py-4">{lead.phone || '—'}</td><td className="px-5 py-4 font-semibold">{lead.configuration || '—'}</td><td className="px-5 py-4"><Interest value={lead.interest}/></td><td className="px-5 py-4">{lead.status || '—'}</td></tr>)}</tbody></table></div>
}

function normalizeConversationTurn(message) {
  const rawRole = String(message?.role || '').toLowerCase()
  const text = String(message?.transcript ?? message?.message ?? '').trim()
  if (!text || !['assistant', 'bot', 'agent', 'user'].includes(rawRole)) return null
  return { role: ['assistant', 'bot', 'agent'].includes(rawRole) ? 'assistant' : 'user', text }
}

function appendConversationTurn(turns, turn) {
  if (!turn || turns.at(-1)?.role === turn.role && turns.at(-1)?.text === turn.text) return turns
  return [...turns, turn]
}

function ConversationThread({ transcript, state, compact = false, onStart, configured = false }) {
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [transcript])

  const hasTranscript = transcript.length > 0
  return <div className={`flex flex-col gap-3 overflow-y-auto pr-1 ${compact ? 'h-48' : 'min-h-0 flex-1'}`} aria-live="polite">
    {!hasTranscript && <div className="flex items-start gap-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center border-2 border-ink bg-signal"><Sparkles size={15}/></span>
      <div className="conversation-message min-w-0 max-w-[85%] break-words border-2 border-ink bg-white px-3 py-2 text-sm leading-6 shadow-[2px_2px_0_#171717]">
        <p className="font-bold">Your conversation will appear here.</p>
        <p className="mt-1 text-xs leading-5 text-zinc-600">Start talking and you’ll see both your messages and the assistant’s replies.</p>
        {onStart && <button
          type="button"
          disabled={!configured || state === 'connecting' || state === 'saving'}
          onClick={onStart}
          className="primary-button mt-3 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Mic size={15}/>{state === 'connecting' ? 'Connecting…' : state === 'connected' ? 'End conversation' : 'Start talking'}
        </button>}
      </div>
    </div>}
    {transcript.map((turn, index) => {
      const isAssistant = ['assistant', 'bot', 'agent'].includes(String(turn.role).toLowerCase())
      return <motion.div
        key={`${index}-${turn.role}-${turn.text}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex min-w-0 items-end gap-2 ${isAssistant ? '' : 'justify-end'}`}
      >
        {isAssistant && <span className="grid h-8 w-8 shrink-0 place-items-center border-2 border-ink bg-signal"><Sparkles size={15}/></span>}
        <div className={`conversation-message min-w-0 max-w-[85%] break-words border-2 border-ink px-3 py-2 text-sm leading-6 shadow-[2px_2px_0_#171717] ${isAssistant ? 'bg-white' : 'bg-[#e7f2e8]'}`}>
          <p className="whitespace-pre-wrap">{turn.text}</p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400">{isAssistant ? 'Mahima AI' : 'You'}</p>
        </div>
        {!isAssistant && <span className="grid h-8 w-8 shrink-0 place-items-center border-2 border-ink bg-sky text-[10px] font-black">YOU</span>}
      </motion.div>
    })}
    {state === 'connecting' && <p className="ml-10 text-xs font-semibold text-zinc-500">Connecting to your assistant…</p>}
    {state === 'connected' && !hasTranscript && <p className="ml-10 text-xs font-semibold text-zinc-500">Listening… start speaking when you’re ready.</p>}
    <div ref={endRef}/>
  </div>
}

function VoiceAssistantModal({ open, onClose, state, status, transcript, onToggle, configured }) {
  if (!open) return null
  const connected = state === 'connected'
  const connecting = state === 'connecting'
  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/60 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget && !connected && !connecting) onClose() }}>
    <motion.section
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-modal-title"
      initial={{ opacity: 0, y: 28, scale: .97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="relative grid h-[100dvh] w-full max-w-xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-2 border-ink bg-paper shadow-[8px_8px_0_#171717] sm:h-[min(90vh,760px)] sm:max-h-[90vh]"
    >
      <div className="relative shrink-0 overflow-hidden border-b-2 border-ink bg-[#20201e] px-4 pb-3 pt-4 text-white sm:px-7 sm:pb-5 sm:pt-6">
        <div className="absolute -right-7 -top-10 h-40 w-40 rounded-full border-[24px] border-white/5"/>
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <span className="tag tag-yellow"><AudioLines size={12} className="mr-1"/> YOUR VOICE ASSISTANT</span>
            <h2 id="voice-modal-title" className="mt-3 font-display text-xl font-black sm:mt-4 sm:text-3xl">Let’s find your kind of home.</h2>
            <p className="mt-2 max-w-md text-xs leading-5 text-white/65">Ask about 3 &amp; 4 BHK homes, pricing, or request a site visit—in Hinglish or English.</p>
          </div>
          <button type="button" className="icon-button shrink-0" aria-label="Close voice assistant" onClick={onClose}><X size={17}/></button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold sm:mt-5">
          <span className="border border-white/30 px-2 py-1">3 &amp; 4 BHK</span>
          <span className="border border-white/30 px-2 py-1">₹5,500 / sq. ft.</span>
          <span className="border border-white/30 px-2 py-1">Tonk Road, Jaipur</span>
        </div>
      </div>
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="eyebrow">YOUR CONVERSATION</p>
          <span className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">
            <span className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-emerald-500' : connecting ? 'animate-pulse bg-amber-500' : 'bg-zinc-300'}`}/>
            {connected ? 'Live' : connecting ? 'Connecting' : state === 'saving' ? 'Saving' : 'Ready'}
          </span>
        </div>
        <ConversationThread transcript={transcript} state={state} onStart={onToggle} configured={configured} />
        <div className="mt-3 grid shrink-0 gap-2 border-t border-dashed border-zinc-300 bg-paper pt-3 sm:pt-4">
          <p className="text-center text-xs text-zinc-500">{status}</p>
          <button type="button" disabled={!configured || connecting || state === 'saving'} onClick={onToggle} className={`primary-button min-h-12 w-full justify-center ${connected ? 'bg-coral' : ''} disabled:cursor-not-allowed disabled:opacity-50`}>
            <Mic size={16}/>{connecting ? 'Connecting…' : connected ? 'End conversation' : state === 'saving' ? 'Saving enquiry…' : 'Start talking'}
          </button>
        </div>
        {!configured && <p className="mt-3 text-xs font-semibold text-coral">Voice assistant isn’t configured yet. Please use the enquiry form.</p>}
      </div>
    </motion.section>
  </div>
}

function VoicePanel({ state, status, transcript = [], onToggle, configured }) {
  const connected = state === 'connected'
  const connecting = state === 'connecting'
  return <section className="brutal-card"><div className="border-b-2 border-ink bg-white px-5 py-4"><p className="eyebrow">Voice workspace</p><h2 className="mt-1 font-display text-xl font-bold">Talk to your agent</h2></div><div className="p-5"><div className="relative overflow-hidden border-2 border-ink bg-[#20201e] p-5 text-white shadow-brutal">
    <div className="flex items-center justify-between"><span className="tag tag-yellow">BROWSER VOICE TEST</span><span className="text-[10px] font-bold text-emerald-300">{connected ? 'CONNECTED' : connecting ? 'CONNECTING' : 'STANDBY'}</span></div>
    <div className="my-5 border-2 border-white/15 bg-white/5 p-3"><ConversationThread transcript={transcript} state={state} compact/></div>
    <p className="text-center font-display text-xl font-bold">Mahima Sales Assistant</p><p className="mt-1 text-center text-xs text-white/60">{status}</p>
    <button disabled={!configured || connecting} onClick={onToggle} className={`mt-5 flex w-full items-center justify-center gap-2 border-2 border-white px-4 py-3 text-sm font-bold text-ink disabled:opacity-50 ${connected ? 'bg-coral' : 'bg-signal'}`}><Mic size={17}/>{connecting ? 'Connecting…' : connected ? 'End voice session' : 'Start browser voice test'}</button>
  </div><p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-500"><CircleHelp size={15} className="mt-0.5 shrink-0"/> Requires Vapi public key, assistant ID, configured assistant and microphone permission. This is a browser voice session, not an outbound phone call.</p></div></section>
}


function CustomerWebsite() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', configuration: 'Undecided', purpose: 'Self-use', preferredVisitDate: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [voiceState, setVoiceState] = useState('idle')
  const [voiceStatus, setVoiceStatus] = useState('Ready when you are')
  const [transcript, setTranscript] = useState([])
  const [voiceModalOpen, setVoiceModalOpen] = useState(false)
  const [voicePanelVisible, setVoicePanelVisible] = useState(true)
  const clientRef = useRef(null)
  const voicePanelRef = useRef(null)
  const transcriptRef = useRef([])
  const callIdRef = useRef(null)
  useEffect(() => {
    if (!isVapiConfigured) return
    const client = createVapiClient(); clientRef.current = client
    client?.on('call-start', () => { setVoiceState('connected'); setVoiceStatus('You’re connected. Go ahead and speak.') })
    client?.on('call-start-success', event => { callIdRef.current = event?.callId || callIdRef.current })
    client?.on('message', message => {
      if (message?.type === 'transcript' && message.transcript && (!message.transcriptType || message.transcriptType === 'final')) {
        const turn = normalizeConversationTurn(message)
        const updated = appendConversationTurn(transcriptRef.current, turn)
        transcriptRef.current = updated
        setTranscript(updated)
      } else if (message?.type === 'conversation-update' && Array.isArray(message.messages)) {
        const turns = message.messages.map(normalizeConversationTurn).filter(Boolean)
        transcriptRef.current = turns
        setTranscript(turns)
      }
    })
    client?.on('call-end', async () => {
      setVoiceState('saving')
      setVoiceStatus('Conversation ended. Saving your enquiry…')
      const transcript = transcriptRef.current
      if (!transcript.length) {
        setVoiceState('idle')
        setVoiceStatus('Call ended without a transcript. You can try again or use the enquiry form.')
        return
      }
      try {
        const result = await api.submitVoiceEnquiry({
          callId: callIdRef.current || crypto.randomUUID(),
          transcript,
        })
        const message = result.message || 'Your conversation was saved.'
        setVoiceStatus(message)
        setNotice(message)
      } catch (error) {
        const message = `Voice enquiry could not be saved: ${error.message}. Please use the enquiry form.`
        setVoiceStatus(message)
        setNotice(message)
      } finally {
        setVoiceState('idle')
        transcriptRef.current = []
        callIdRef.current = null
      }
    })
    client?.on('error', error => {
      setVoiceState('idle')
      const message = `Voice session error: ${error?.message || 'Please check microphone permission or use the enquiry form.'}`
      setVoiceStatus(message)
      setNotice(message)
    })
    return () => { try { client?.stop() } catch {} }
  }, [])
  useEffect(() => {
    if (!voiceModalOpen || voiceState === 'connected' || voiceState === 'connecting') return
    const handleKeyDown = event => { if (event.key === 'Escape') setVoiceModalOpen(false) }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [voiceModalOpen, voiceState])
  useEffect(() => {
    const panel = voicePanelRef.current
    if (!panel || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => setVoicePanelVisible(entry.isIntersecting), { threshold: 0.05 })
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])
  async function submit(e) {
    e.preventDefault(); setBusy(true); setNotice('')
    try { const result = await api.submitEnquiry(form); setNotice(result.message || 'Enquiry submitted successfully.'); setForm({ name: '', phone: '', email: '', configuration: 'Undecided', purpose: 'Self-use', preferredVisitDate: '', message: '' }) }
    catch (err) { setNotice(`Could not submit enquiry: ${err.message}`) } finally { setBusy(false) }
  }
  async function toggleVoice() {
    const client = clientRef.current
    if (!client) { setVoiceStatus('Voice assistant is not configured yet. Please use the enquiry form.'); return }
    if (voiceState === 'connected' || voiceState === 'connecting') { setVoiceStatus('Ending voice session…'); client.stop(); return }
    try {
      transcriptRef.current = []
      callIdRef.current = null
      setTranscript([])
      setNotice('')
      setVoiceState('connecting')
      setVoiceStatus('Requesting microphone permission and connecting…')
      await client.start(vapiAssistantId)
    } catch (error) {
      const message = `Could not start voice session: ${error?.message || 'Please check microphone permission or use the form.'}`
      setVoiceState('idle')
      setVoiceStatus(message)
      setNotice(message)
    }
  }
  return <div className="min-h-screen bg-paper text-ink"><header className="border-b-2 border-ink bg-paper"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><div className="font-display text-2xl font-black">MAHIMA<span className="text-coral">.</span></div><a className="secondary-button" href="/admin">Sales team login <ArrowUpRight size={14}/></a></div></header>
    <main className="mx-auto max-w-6xl px-5 py-12"><section className="grid items-center gap-10 lg:grid-cols-[1.2fr_.8fr]"><div><span className="tag tag-coral">MAHIMA PALM SPRINGS · JAIPUR</span><h1 className="mt-5 max-w-3xl font-display text-5xl font-black leading-[1.02] tracking-tight md:text-7xl">Find a home that feels like <span className="text-coral">yours.</span></h1><p className="mt-6 max-w-xl text-base leading-7 text-zinc-600">Explore spacious 3 BHK and 4 BHK residences on Tonk Road, Jaipur. Share your requirements or speak with our AI sales assistant.</p><div className="mt-8 grid max-w-xl grid-cols-2 gap-3">{[['3 & 4 BHK','Configurations'],['1,705–2,619','Sq. ft.'],['₹5,500','Rate per sq. ft.'],['Jan 2027','Expected possession']].map(([v,l])=><div key={l} className="brutal-card p-4"><p className="font-display text-2xl font-black">{v}</p><p className="mt-1 text-xs text-zinc-500">{l}</p></div>)}</div><p className="mt-5 text-xs text-zinc-500">Tonk Road · Approx. 3 km from Chokhi Dhani · Opposite Radha Swami Satsang Beas</p></div>
      <section ref={voicePanelRef} className="voice-assistant-card brutal-card p-6"><span className="tag tag-yellow">AI VOICE ASSISTANT</span><h2 className="mt-5 font-display text-3xl font-black">Have a quick conversation.</h2><p className="mt-3 text-sm leading-6">Ask about configurations, location, indicative pricing or request a site visit. The assistant can speak with you in Hinglish or English.</p><div className="my-5 border-2 border-white/15 bg-white/5 p-3"><ConversationThread transcript={transcript} state={voiceState} compact/></div><p className="mb-4 text-center text-xs">{voiceStatus}</p><button onClick={() => setVoiceModalOpen(true)} className="mt-2 flex w-full items-center justify-center gap-2 border-2 border-white bg-signal px-5 py-4 font-bold text-ink"><Mic size={18}/>{voiceState === 'connected' ? 'Return to conversation' : 'Talk to AI assistant'}<ArrowUpRight size={15}/></button><p className="mt-3 text-center text-[11px] text-white/70">Microphone permission is requested only when you start the conversation.</p></section></section>
    <section id="enquiry" className="mt-16 grid gap-8 lg:grid-cols-[.7fr_1.3fr]"><div><p className="eyebrow">LET'S CONNECT</p><h2 className="mt-2 font-display text-4xl font-black">Request a callback or site visit.</h2><p className="mt-4 text-sm leading-6 text-zinc-600">Share your details and the sales team can follow up. A submitted date is a preference, not a confirmed appointment.</p></div><form onSubmit={submit} className="brutal-card grid gap-4 p-6 sm:grid-cols-2"><label className="text-xs font-bold">Full name *<input className="brutal-input mt-2 w-full" required minLength={2} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label className="text-xs font-bold">Phone number *<input className="brutal-input mt-2 w-full" required minLength={8} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label className="text-xs font-bold">Email (optional)<input className="brutal-input mt-2 w-full" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label className="text-xs font-bold">Configuration<select className="brutal-input mt-2 w-full" value={form.configuration} onChange={e=>setForm({...form,configuration:e.target.value})}><option>Undecided</option><option>3 BHK</option><option>4 BHK</option></select></label><label className="text-xs font-bold">Purpose<select className="brutal-input mt-2 w-full" value={form.purpose} onChange={e=>setForm({...form,purpose:e.target.value})}><option>Self-use</option><option>Investment</option><option>Not decided</option></select></label><label className="text-xs font-bold">Preferred site visit date<input className="brutal-input mt-2 w-full" type="date" value={form.preferredVisitDate} onChange={e=>setForm({...form,preferredVisitDate:e.target.value})}/></label><label className="text-xs font-bold sm:col-span-2">Message (optional)<textarea className="brutal-input mt-2 min-h-24 w-full" value={form.message} onChange={e=>setForm({...form,message:e.target.value})} placeholder="Tell us what you would like to know…"/></label><div className="sm:col-span-2"><button className="primary-button" disabled={busy}>{busy ? 'Submitting…' : 'Submit enquiry'} <ArrowUpRight size={15}/></button>{notice && <p className="mt-3 border-2 border-ink bg-signal p-3 text-xs font-bold">{notice}</p>}<p className="mt-3 text-[10px] text-zinc-500">By submitting, you request the Mahima Palm Springs team to contact you about this enquiry.</p></div></form></section></main><footer className="border-t-2 border-ink px-5 py-6 text-center text-xs text-zinc-500">MAHIMA PALM SPRINGS · TONK ROAD, JAIPUR</footer>
    {!voicePanelVisible && !voiceModalOpen && <motion.button type="button" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .5 }} onClick={() => setVoiceModalOpen(true)} aria-label="Open Mahima AI voice assistant" className="fixed bottom-5 right-5 z-40 flex items-center gap-3 border-2 border-ink bg-signal px-3 py-3 text-left shadow-[4px_4px_0_#171717] transition hover:translate-y-0.5 hover:shadow-[2px_2px_0_#171717] sm:bottom-7 sm:right-7 sm:px-4">
      <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-white"><MessageCircle size={19}/></span>
      <span className="hidden sm:block"><span className="block text-xs font-black">{voiceState === 'connected' ? 'Conversation live' : 'Talk with Mahima AI'}</span><span className="mt-0.5 block text-[9px] font-bold uppercase tracking-widest">{voiceState === 'connected' ? 'Tap to return' : 'Ask about your new home'}</span></span>
      <ArrowUpRight size={16} className="hidden sm:block"/>
    </motion.button>}
    <VoiceAssistantModal open={voiceModalOpen} onClose={() => setVoiceModalOpen(false)} state={voiceState} status={voiceStatus} transcript={transcript} onToggle={toggleVoice} configured={isVapiConfigured}/>
  </div>
}

export default function App() {
  const [active, setActive] = useState('Overview')
  const [user, setUser] = useState(null)
  const [teamProfile, setTeamProfile] = useState(null)
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured)
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [leads, setLeads] = useState([])
  const [calls, setCalls] = useState([])
  const [search, setSearch] = useState('')
  const [voiceState, setVoiceState] = useState('idle')
  const [voiceStatus, setVoiceStatus] = useState('Ready to test')
  const [toast, setToast] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [leadModal, setLeadModal] = useState(false)
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', configuration: '3 BHK', interest: 'Warm', status: 'New enquiry' })
  const [savingLead, setSavingLead] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [apiError, setApiError] = useState('')
  const vapiRef = useRef(null)
  const transcriptRef = useRef([])
  const callIdRef = useRef(null)

  const notify = message => setToast(message)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    return onAuthStateChanged(auth, current => { setUser(current); setAuthReady(true) })
  }, [])

  async function loadData(currentUser = user) {
    if (!currentUser) return
    setLoadingData(true); setApiError('')
    try {
      const token = await currentUser.getIdToken()
      const [profile, leadData, callData] = await Promise.all([api.getTeamMe(token), api.getLeads(token), api.getCalls(token)])
      setTeamProfile(profile); setLeads(leadData); setCalls(callData)
    } catch (error) {
      setApiError(error.message)
    } finally { setLoadingData(false) }
  }

  useEffect(() => { if (user && !loginBusy) loadData(user) }, [user, loginBusy])

  useEffect(() => {
    if (!isVapiConfigured) return
    const client = createVapiClient()
    vapiRef.current = client
    if (!client) return
    const onStart = () => { setVoiceState('connected'); setVoiceStatus('Microphone connected — speak naturally') }
    const onEnd = async () => {
      setVoiceState('idle')
      const transcript = transcriptRef.current
      if (!transcript.length) {
        setVoiceStatus('Call ended without a transcript. No lead was saved.')
        return
      }
      setVoiceStatus('Saving voice enquiry…')
      try {
        const result = await api.submitVoiceEnquiry({
          callId: callIdRef.current || crypto.randomUUID(),
          transcript,
        })
        setVoiceStatus(result.message)
        if (auth.currentUser) await loadData(auth.currentUser)
      } catch (error) {
        setVoiceStatus(`Could not save voice enquiry: ${error.message}`)
      } finally {
        transcriptRef.current = []
        callIdRef.current = null
      }
    }
    const onCallStartSuccess = event => { callIdRef.current = event?.callId || callIdRef.current }
    const onMessage = message => {
      if (message?.type === 'transcript' && message.transcript && (!message.transcriptType || message.transcriptType === 'final')) {
        transcriptRef.current = [...transcriptRef.current, { role: message.role || 'assistant', text: message.transcript }]
      }
    }
    const onError = error => { console.error(error); setVoiceState('idle'); setVoiceStatus('Voice connection error'); notify(error?.message || 'Vapi voice error.') }
    client.on('call-start', onStart); client.on('call-start-success', onCallStartSuccess); client.on('call-end', onEnd); client.on('message', onMessage); client.on('error', onError)
    return () => { try { client.stop() } catch {}; client.removeAllListeners?.(); vapiRef.current = null }
  }, [])

  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 3500); return () => clearTimeout(id) }, [toast])

  async function login(email, password) {
    setLoginBusy(true); setLoginError('')
    try { await signInWithEmailAndPassword(auth, email, password) }
    catch (error) { setLoginError(error.message || 'Sign-in failed.') }
    finally { setLoginBusy(false) }
  }

  async function loginWithGoogle() {
    setLoginBusy(true); setLoginError('')
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider())
      const token = await credential.user.getIdToken()
      await api.registerSales(token)
    } catch (error) {
      if (auth.currentUser) {
        try { await signOut(auth) }
        catch (signOutError) { console.error('Could not sign out after rejected Google registration.', signOutError) }
      }
      setUser(null)
      setLoginError(error.message || 'Google sign-in failed.')
    } finally { setLoginBusy(false) }
  }

  async function saveLead(event) {
    event.preventDefault()
    if (!user) { notify('Configure Firebase Authentication and sign in first.'); return }
    setSavingLead(true)
    try {
      const token = await user.getIdToken()
      await api.createLead(token, { ...leadForm, source: 'Manual dashboard entry' })
      await loadData(user)
      setLeadForm({ name: '', phone: '', configuration: '3 BHK', interest: 'Warm', status: 'New enquiry' })
      setLeadModal(false); notify('Lead saved through FastAPI to Firestore.')
    } catch (error) { notify(`Could not save lead: ${error.message}`) }
    finally { setSavingLead(false) }
  }

  async function toggleVoice() {
    const client = vapiRef.current
    if (!client) { notify('Add Vapi public key and assistant ID to frontend/.env.local, then restart Vite.'); return }
    if (voiceState === 'connected' || voiceState === 'connecting') { client.stop(); setVoiceStatus('Ending voice session…'); return }
    try { transcriptRef.current = []; callIdRef.current = null; setVoiceState('connecting'); setVoiceStatus('Requesting microphone and connecting…'); await client.start(vapiAssistantId) }
    catch (error) { console.error(error); setVoiceState('idle'); setVoiceStatus('Could not start voice session'); notify(error?.message || 'Check Vapi assistant and microphone permission.') }
  }

  const filteredLeads = useMemo(() => leads.filter(lead => `${lead.name || ''} ${lead.phone || ''} ${lead.configuration || ''}`.toLowerCase().includes(search.toLowerCase())), [leads, search])
  const pageTitle = active === 'Overview' ? 'Sales command center' : active

  if (window.location.pathname !== '/admin' && window.location.pathname !== '/admin/') return <CustomerWebsite />
  if (!authReady) return <div className="grid min-h-screen place-items-center"><LoaderCircle className="animate-spin" size={30}/></div>
  if (isFirebaseConfigured && (!user || loginBusy)) return <Login onLogin={login} onGoogleLogin={loginWithGoogle} busy={loginBusy} error={loginError}/>

  return <div className="min-h-screen bg-paper text-ink"><div className="grain"/>
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-paper/95 backdrop-blur"><div className="mx-auto flex h-[76px] max-w-[1600px] items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-3"><button className="icon-button lg:hidden" onClick={() => setMobileNav(!mobileNav)}><Menu size={19}/></button><div className="grid h-10 w-10 rotate-[-3deg] place-items-center border-2 border-ink bg-signal shadow-brutal-sm"><Command size={22}/></div><div><div className="font-display text-xl font-bold leading-none tracking-[-.06em]">MAHIMA<span className="text-coral">.AI</span></div><div className="mt-1 text-[9px] font-bold uppercase tracking-[.2em] text-zinc-500">Real estate voice intelligence</div></div></div>
      <div className="flex items-center gap-2"><span className={`status-dot ${isFirebaseConfigured ? '' : 'bg-amber-500'}`}/><span className="hidden text-[10px] font-bold sm:inline">{isFirebaseConfigured ? (user ? `${teamProfile?.role || 'VERIFYING'} ACCOUNT` : 'FIREBASE READY') : 'PREVIEW MODE'}</span>{user && <><span className="hidden max-w-36 truncate text-xs font-bold sm:block">{teamProfile?.role?.toUpperCase() || 'TEAM'} · {user.email}</span><button className="icon-button" title="Sign out" onClick={() => signOut(auth)}><LogOut size={16}/></button></>}</div>
    </div></header>
    <div className="mx-auto flex max-w-[1600px]">
      <aside className={`${mobileNav ? 'fixed inset-y-[76px] left-0 z-40 flex w-[260px] shadow-brutal' : 'hidden'} w-[250px] shrink-0 flex-col border-r-2 border-ink bg-[#f0efe8] p-5 lg:sticky lg:top-[76px] lg:flex lg:h-[calc(100vh-76px)]`}>
        <p className="eyebrow mb-4">{teamProfile?.role === 'admin' ? 'Administrator workspace' : 'Sales workspace'}</p><nav className="space-y-2">{navItems.map(item => <button key={item.label} onClick={() => { setActive(item.label); setMobileNav(false) }} className={`nav-link ${active === item.label ? 'nav-link-active' : ''}`}><item.icon size={18}/><span>{item.label}</span>{active === item.label && <span className="ml-auto h-2 w-2 bg-ink"/>}</button>)}</nav>
        <div className="mt-9"><p className="eyebrow mb-3">Project</p><div className="border-2 border-ink bg-white p-3 shadow-brutal-sm"><p className="text-xs font-bold">Mahima Palm Springs</p><p className="mt-1 text-[10px] text-zinc-500">Jaipur · Tonk Road</p><div className="mt-3 flex justify-between border-t border-dashed border-zinc-300 pt-2 text-[10px]"><span className="text-zinc-500">Vapi</span><span className="font-bold">{isVapiConfigured ? 'CONFIGURED' : 'SETUP NEEDED'}</span></div></div></div>
        <div className="mt-auto border-2 border-ink bg-signal p-4 shadow-brutal-sm"><Sparkles size={18}/><p className="mt-3 font-display text-lg font-bold leading-tight">Turn enquiries into visits.</p><p className="mt-2 text-[11px] leading-relaxed">AI sales conversations, managed in one place.</p></div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-7 md:px-8 md:py-9">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2"><span className="tag tag-coral">MAHIMA PALM SPRINGS</span><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">/ {active}</span></div><h1 className="font-display text-3xl font-bold tracking-[-.05em] md:text-4xl">{pageTitle}<span className="text-coral">.</span></h1><p className="mt-2 max-w-2xl text-sm text-zinc-500">Manage enquiries, test your voice assistant and track site-visit intent.</p></div><div className="flex items-center gap-2">{active === 'Leads' && <button className="primary-button" onClick={() => setLeadModal(true)}><Plus size={15}/> Add lead</button>}<button className="secondary-button" onClick={() => loadData()}><Settings size={15}/> Refresh data</button></div></div>
        {apiError && <div className="mb-5 border-2 border-ink bg-coral p-3 text-xs font-bold">Backend API: {apiError}. Confirm FastAPI is running and VITE_API_BASE_URL is correct.</div>}
        {active === 'Overview' && <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Stored leads" value={leads.length} note="Firestore records via FastAPI" icon={Users} color="bg-signal"/><StatCard label="Saved calls" value={calls.length} note="Vapi webhook records" icon={Phone} color="bg-coral"/><StatCard label="Visit requests" value={leads.filter(l => String(l.status || '').toLowerCase().includes('visit')).length} note="Lead status matches" icon={CalendarDays} color="bg-mint"/><StatCard label="Voice agent" value={isVapiConfigured ? 'READY' : 'SETUP'} note="Vapi browser configuration" icon={AudioLines} color="bg-sky"/></div>
          <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]"><section className="brutal-card overflow-hidden"><div className="flex items-center justify-between border-b-2 border-ink bg-white px-5 py-4"><div><p className="eyebrow">Lead pipeline</p><h2 className="mt-1 font-display text-xl font-bold">Recent enquiries</h2></div><button className="text-xs font-bold underline" onClick={() => setActive('Leads')}>View leads <ArrowUpRight className="inline" size={13}/></button></div>{leads.length ? <LeadTable leads={leads.slice(0,5)}/> : <div className="p-8 text-center"><Users className="mx-auto text-zinc-400"/><p className="mt-2 text-sm font-bold">No leads yet</p><p className="mt-1 text-xs text-zinc-500">Add a lead from the Leads section.</p></div>}</section><VoicePanel state={voiceState} status={voiceStatus} onToggle={toggleVoice} configured={isVapiConfigured}/></div>
        </>}
        {active === 'Leads' && <section className="brutal-card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-white p-5"><div><p className="eyebrow">Prospect database</p><h2 className="font-display text-xl font-bold">All leads</h2></div><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/><input className="brutal-input pl-9" placeholder="Search leads…" value={search} onChange={e => setSearch(e.target.value)}/></div></div>{leads.length ? <LeadTable leads={filteredLeads}/> : <div className="p-10 text-center"><Users className="mx-auto text-zinc-400"/><p className="mt-3 font-bold">No leads saved yet</p><button className="primary-button mt-4" onClick={() => setLeadModal(true)}><Plus size={15}/> Add first lead</button></div>}</section>}
        {active === 'Call history' && <section className="brutal-card overflow-hidden"><div className="border-b-2 border-ink bg-white p-5"><p className="eyebrow">Voice activity</p><h2 className="font-display text-xl font-bold">Vapi call history</h2></div>{calls.length ? <div className="divide-y divide-zinc-200">{calls.map(call => <div key={call.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="text-sm font-bold">{call.summary || call.outcome || 'Completed Vapi call'}</p><p className="mt-1 text-[10px] text-zinc-500">{call.id} · {call.endedReason || call.status || '—'}</p></div><div className="text-xs font-semibold">{call.duration ? `${Math.round(call.duration)} sec` : 'Duration unavailable'}</div>{call.recordingUrl && <a className="text-xs font-bold underline" href={call.recordingUrl} target="_blank" rel="noreferrer">Open recording</a>}</div>)}</div> : <div className="p-10 text-center"><Phone className="mx-auto text-zinc-400"/><p className="mt-3 font-bold">No Vapi call reports yet</p><p className="mt-1 text-xs text-zinc-500">Completed calls arrive through the configured Vapi webhook.</p></div>}</section>}
        {active === 'Voice agent' && <div className="grid gap-6 xl:grid-cols-2"><section className="brutal-card p-6"><p className="eyebrow">Assistant configuration</p><h2 className="mt-1 font-display text-2xl font-bold">Mahima Sales Assistant</h2><div className="mt-6 space-y-3">{[['Voice provider','Vapi'],['Assistant ID',isVapiConfigured ? 'Configured' : 'Missing frontend .env.local'],['Public key',import.meta.env.VITE_VAPI_PUBLIC_KEY ? 'Configured' : 'Missing frontend .env.local'],['Language','Set Hindi/English-compatible voice and transcriber in Vapi'],['Session','Browser voice test; no outbound phone call']].map(([k,v]) => <div key={k} className="flex flex-wrap justify-between gap-2 border-b border-dashed border-zinc-300 py-3 text-xs"><b>{k}</b><span className="text-right text-zinc-500">{v}</span></div>)}</div></section><VoicePanel state={voiceState} status={voiceStatus} onToggle={toggleVoice} configured={isVapiConfigured}/></div>}
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink pt-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-400"><span>MAHIMA.AI · {teamProfile?.role?.toUpperCase() || 'TEAM'} WORKSPACE</span><span>Mahima Palm Springs · Jaipur</span></footer>
      </main>
    </div>
    {leadModal && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><motion.form onSubmit={saveLead} className="w-full max-w-md border-2 border-ink bg-paper p-6 shadow-brutal"><div className="mb-5 flex items-center justify-between"><div><p className="eyebrow">Lead management</p><h2 className="font-display text-2xl font-bold">Add new lead</h2></div><button type="button" className="icon-button" onClick={() => setLeadModal(false)}><X size={17}/></button></div><div className="space-y-3"><label className="block text-xs font-bold">Customer name<input className="brutal-input mt-1 w-full" required value={leadForm.name} onChange={e => setLeadForm({...leadForm,name:e.target.value})}/></label><label className="block text-xs font-bold">Phone number<input className="brutal-input mt-1 w-full" value={leadForm.phone} onChange={e => setLeadForm({...leadForm,phone:e.target.value})} placeholder="+91…"/></label><label className="block text-xs font-bold">Configuration<select className="brutal-input mt-1 w-full" value={leadForm.configuration} onChange={e => setLeadForm({...leadForm,configuration:e.target.value})}><option>3 BHK</option><option>4 BHK</option><option>Undecided</option></select></label><label className="block text-xs font-bold">Interest<select className="brutal-input mt-1 w-full" value={leadForm.interest} onChange={e => setLeadForm({...leadForm,interest:e.target.value})}><option>Hot</option><option>Warm</option><option>Cold</option></select></label><button className="primary-button mt-2 w-full justify-center" disabled={savingLead}>{savingLead ? 'Saving…' : 'Save lead'} <Check size={15}/></button></div></motion.form></div>}
    {toast && <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 border-2 border-ink bg-signal p-4 text-xs font-bold shadow-brutal"><span>{toast}</span><button onClick={() => setToast('')}><X size={15}/></button></motion.div>}
  </div>
}
