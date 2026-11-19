import Vapi from '@vapi-ai/web'

export const vapiPublicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY || ''
export const vapiAssistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID || ''
export const isVapiConfigured = Boolean(vapiPublicKey && vapiAssistantId)


export const createVapiClient = () => isVapiConfigured ? new Vapi(vapiPublicKey) : null
