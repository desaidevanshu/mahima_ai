import Vapi from '@vapi-ai/web'

export const vapiPublicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY || ''
export const vapiAssistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID || ''
export const isVapiConfigured = Boolean(vapiPublicKey && vapiAssistantId)

// A public key is intended for browser SDK use. Restrict it in Vapi to your app origin
// and allowed assistant. Never use a Vapi private API key in the frontend.
export const createVapiClient = () => isVapiConfigured ? new Vapi(vapiPublicKey) : null
