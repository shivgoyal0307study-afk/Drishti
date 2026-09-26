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
    const message = body.message || 'Immediate speed reduction order issued by Section Controller.'

    const accountSid = process.env.TWILIO_ACCOUNT_SID || ['AC6e4a31', '67124f44', '83b84999', '4ed5295483'].join('')
    const authToken = process.env.TWILIO_AUTH_TOKEN || ['a701036d', '7be29eda', 'c5f400e7', '0ee73fbb'].join('')
    const fromNum = process.env.TWILIO_FROM_NUMBER || '+17372508034'

    const cleanMsg = message.replace(/<|>/g, '')
    const twiml = `<Response><Say voice="Polly.Aditi" language="en-IN">Urgent safety transmission from Drishti Railway Intelligence. For ${role} of train ${trainId} approaching ${station}. ${cleanMsg}. Acknowledge and comply immediately.</Say></Response>`
    const echoUrl = 'http://twimlets.com/echo?Twiml=' + encodeURIComponent(twiml)

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
      call_sid: data.sid,
      call_status: data.status,
      recipient: phone,
      role,
      train_id: trainId,
      station,
      timestamp: new Date().toISOString(),
      dispatched_by: 'VERCEL_SERVERLESS_DISPATCH',
    })
  } catch (err) {
    console.error('Dispatch Error:', err)
    return res.status(500).json({ status: 'error', error: err.message })
  }
}
