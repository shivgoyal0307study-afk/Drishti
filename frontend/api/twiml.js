export default function handler(req, res) {
  // Set CORS & XML content-type
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'text/xml; charset=utf-8')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const query = req.query || {}
  const body = req.body || {}

  const trainId = query.train_id || body.train_id || '12301'
  const station = query.station || body.station || 'Howrah Jn'
  const role = query.role || body.role || 'Loco Pilot'
  const reason = (query.reason || body.reason || 'Point Interlocking / SPAD Safety Alert').replace(/<|>/g, '')
  const action = (query.action || body.action || 'Immediate speed reduction order issued by Section Controller.').replace(/<|>/g, '')

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="2"/>
  <Say voice="Polly.Aditi" language="en-IN">
    Emergency Alert. Emergency Alert.
    This is Drishti Railway Operations Control with an urgent safety transmission.
    Calling ${role} of train number ${trainId} approaching station ${station}.
    The critical reason for this emergency call is: ${reason}.
    I repeat, the reason for this emergency call is: ${reason}.
    Direct order from Section Controller: ${action}.
    Acknowledge and comply immediately.
  </Say>
  <Pause length="2"/>
  <Say voice="Polly.Aditi" language="en-IN">
    Repeating emergency dispatch for train ${trainId} approaching ${station}.
    Emergency reason: ${reason}.
    Take immediate safety action.
  </Say>
</Response>`

  return res.status(200).send(twiml)
}
