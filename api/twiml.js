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

  const xmlTrain = escapeXml(trainId)
  const xmlStation = escapeXml(station)
  const xmlRole = escapeXml(role)
  const xmlReason = escapeXml(reason)
  const xmlAction = escapeXml(action)

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="2"/>
  <Say voice="alice" language="en-IN">
    Emergency Alert. Emergency Alert.
    This is Drishti Railway Operations Control with an urgent safety transmission.
    Calling ${xmlRole} of train number ${xmlTrain} approaching station ${xmlStation}.
    The critical reason for this emergency call is: ${xmlReason}.
    I repeat, the reason for this emergency call is: ${xmlReason}.
    Direct order from Section Controller: ${xmlAction}.
    Acknowledge and comply immediately.
  </Say>
  <Pause length="2"/>
  <Say voice="alice" language="en-IN">
    Repeating emergency dispatch for train ${xmlTrain} approaching station ${xmlStation}.
    Emergency reason: ${xmlReason}.
    Take immediate safety action.
  </Say>
</Response>`

  return res.status(200).send(twiml)
}
