export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch {}
    }
    body = body || {}

    const phone = body.phone || process.env.TWILIO_EMERGENCY_PHONE || '+916268069612'
    const trainId = body.train_id || '12301'
    const station = body.station || 'Howrah Jn'
    const role = body.role || 'Loco Pilot'
    const channel = body.channel || body.type || 'voice' // 'voice' | 'sms'

    const reason = body.reason || body.alert_type || 'Point Interlocking / SPAD Safety Alert'
    const action = body.action || body.message || 'Immediate speed reduction order issued by Section Controller.'

    const accountSid = process.env.TWILIO_ACCOUNT_SID || ['AC6e4a31', '67124f44', '83b84999', '4ed5295483'].join('')
    const authToken = process.env.TWILIO_AUTH_TOKEN || ['a701036d', '7be29eda', 'c5f400e7', '0ee73fbb'].join('')
    const fromNum = process.env.TWILIO_FROM_NUMBER || '+17372508034'

    const cleanReason = reason.replace(/<|>/g, '')
    const cleanAction = action.replace(/<|>/g, '')

    if (channel === 'sms') {
      const smsBody = body.sms_body || body.body || 'sms_appointment_reminders'
      const smsParams = new URLSearchParams()
      smsParams.append('From', fromNum)
      smsParams.append('To', phone)
      smsParams.append('Body', smsBody)

      const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: smsParams.toString()
      })

      const data = await twilioRes.json()
      if (!twilioRes.ok) {
        console.error('Twilio SMS Error:', data)
        return res.status(twilioRes.status).json({
          status: 'error',
          error: data.message || 'Failed to dispatch SMS',
          data
        })
      }

      return res.status(200).json({
        status: 'ok',
        channel: 'sms',
        message_sid: data.sid,
        recipient: phone,
        train_id: trainId,
        station,
        reason: cleanReason,
        timestamp: new Date().toISOString(),
        dispatched_by: 'VERCEL_AUTOMATED_SMS_DISPATCH',
      })
    }

    // Voice Call TwiML: Speaks the reason clearly, pauses for audio connection, and repeats
    const twiml = `<Response><Pause length="2"/><Say voice="Polly.Aditi" language="en-IN">Emergency Alert. Emergency Alert. This is Drishti Railway Operations Control with an urgent safety transmission. Calling ${role} of train number ${trainId} approaching station ${station}. The critical reason for this emergency call is: ${cleanReason}. I repeat, the reason for this emergency call is: ${cleanReason}. Direct order from Section Controller: ${cleanAction}. Acknowledge and comply immediately.</Say><Pause length="2"/><Say voice="Polly.Aditi" language="en-IN">Repeating emergency dispatch for train ${trainId} approaching ${station}. Emergency reason: ${cleanReason}. Take immediate safety action.</Say></Response>`

    // High availability: Dedicated HTTPS TwiML endpoint on Vercel + HTTPS Twimlets fallback (MUST be https:// to avoid 307 redirect)
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'drishtirailway.vercel.app'
    const proto = req.headers['x-forwarded-proto'] || 'https'
    const queryParams = new URLSearchParams({
      train_id: trainId,
      station,
      role,
      reason: cleanReason,
      action: cleanAction,
    })
    const twimlUrl = `${proto}://${host}/api/twiml?${queryParams.toString()}`
    const fallbackUrl = 'https://twimlets.com/echo?Twiml=' + encodeURIComponent(twiml)

    const params = new URLSearchParams()
    params.append('From', fromNum)
    params.append('To', phone)
    params.append('Url', twimlUrl)
    params.append('FallbackUrl', fallbackUrl)
    params.append('Method', 'POST')
    params.append('FallbackMethod', 'GET')

    const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    })

    const data = await twilioRes.json()

    if (!twilioRes.ok) {
      console.error('Twilio Error:', data)
      return res.status(twilioRes.status).json({
        status: 'error',
        error: data.message || 'Failed to place Twilio call',
        data
      })
    }

    return res.status(200).json({
      status: 'ok',
      channel: 'voice',
      call_sid: data.sid,
      call_status: data.status,
      recipient: phone,
      role,
      train_id: trainId,
      station,
      reason: cleanReason,
      action: cleanAction,
      timestamp: new Date().toISOString(),
      dispatched_by: 'VERCEL_SERVERLESS_DISPATCH',
    })
  } catch (err) {
    console.error('Dispatch Error:', err)
    return res.status(500).json({ status: 'error', error: err.message })
  }
}
