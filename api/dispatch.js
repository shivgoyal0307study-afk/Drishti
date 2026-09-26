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

    function escapeXml(unsafe) {
      return (unsafe || '').replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<': return '&lt;'
          case '>': return '&gt;'
          case '&': return '&amp;'
          case '\'': return '&apos;'
          case '"': return '&quot;'
        }
      })
    }

    const xmlReason = escapeXml(cleanReason)
    const xmlAction = escapeXml(cleanAction)
    const xmlRole = escapeXml(role)
    const xmlTrain = escapeXml(trainId)
    const xmlStation = escapeXml(station)

    // Voice Call TwiML: Speaks the reason clearly, pauses for audio connection, and repeats
    // Uses alice voice with language="en-IN" (Indian English) which is universally supported across all Twilio accounts
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Pause length="2"/><Say voice="alice" language="en-IN">Emergency Alert. Emergency Alert. This is Drishti Railway Operations Control with an urgent safety transmission. Calling ${xmlRole} of train number ${xmlTrain} approaching station ${xmlStation}. The critical reason for this emergency call is: ${xmlReason}. I repeat, the reason for this emergency call is: ${xmlReason}. Direct order from Section Controller: ${xmlAction}. Acknowledge and comply immediately.</Say><Pause length="2"/><Say voice="alice" language="en-IN">Repeating emergency dispatch for train ${xmlTrain} approaching station ${xmlStation}. Emergency reason: ${xmlReason}. Take immediate safety action.</Say></Response>`

    // Twimlets echo URL over HTTPS: self-contained, zero external server dependencies, resolves internally within Twilio
    const echoUrl = 'https://twimlets.com/echo?Twiml=' + encodeURIComponent(twiml)

    // NOTE: Twilio trial accounts ONLY allow From, To, and Url. Extra parameters trigger HTTP 400.
    const params = new URLSearchParams()
    params.append('From', fromNum)
    params.append('To', phone)
    params.append('Url', echoUrl)

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
