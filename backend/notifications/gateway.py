"""
DRISHTI Notification Gateway
Multi-channel alerting: SMS, Email, Push, In-App messages
Routes alerts to railway personnel based on severity and location
"""

import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Literal
from enum import Enum

logger = logging.getLogger(__name__)

# ============================================================================
# MESSAGE CHANNEL & RECIPIENT TYPES
# ============================================================================

class NotificationChannel(str, Enum):
    """Supported notification channels"""
    SMS = "sms"                      # SMS to mobile
    VOICE = "voice"                  # Voice call to mobile
    EMAIL = "email"                  # Email to address
    PUSH = "push"                    # Push notification to app
    IN_APP = "in_app"                # In-app message
    WHATSAPP = "whatsapp"            # WhatsApp message
    TELEGRAM = "telegram"            # Telegram bot
    CENTRAL_LOG = "central_log"      # Central command room log


class RecipientRole(str, Enum):
    """Railway personnel roles"""
    LOCO_PILOT = "loco_pilot"                          # Driver
    ASSISTANT_PILOT = "assistant_pilot"                # Second driver
    GUARD = "guard"                                    # Guard/Brake van operator
    STATION_MASTER = "station_master"                  # Station controller
    SECTION_CONTROLLER = "section_controller"          # Line controller
    SIGNALLING_OFFICER = "signalling_officer"          # Signal operator
    CENTRAL_OPERATIONS = "central_operations"          # Central control room
    ZONE_OPERATIONS = "zone_operations"                # Zone operations center
    EMERGENCY_SERVICES = "emergency_services"          # External emergency response
    MAINTENANCE_SUPERVISOR = "maintenance_supervisor"  # Maintenance head


# ============================================================================
# NOTIFICATION CLASSES
# ============================================================================

@dataclass
class NotificationRecipient:
    """Individual recipient with contact info"""
    recipient_id: str  # Unique ID (employee number)
    name: str
    role: RecipientRole
    phone: Optional[str] = None  # For SMS/WhatsApp
    email: Optional[str] = None
    location: Optional[str] = None  # Station/zone they manage
    app_user_id: Optional[str] = None  # For push/in-app
    online_status: bool = False  # Currently logged in
    
    def get_channels(self) -> List[NotificationChannel]:
        """Get available channels for this recipient"""
        channels = []
        if self.phone:
            channels.extend([NotificationChannel.SMS, NotificationChannel.WHATSAPP])
            if self.role in [RecipientRole.LOCO_PILOT, RecipientRole.STATION_MASTER]:
                channels.append(NotificationChannel.VOICE)
        if self.email:
            channels.append(NotificationChannel.EMAIL)
        if self.app_user_id:
            channels.append(NotificationChannel.PUSH)
        if self.role in [RecipientRole.CENTRAL_OPERATIONS, RecipientRole.ZONE_OPERATIONS]:
            channels.append(NotificationChannel.CENTRAL_LOG)
        return channels


@dataclass
class NotificationMessage:
    """Core notification message"""
    notification_id: str  # Unique ID
    timestamp: str  # ISO 8601
    severity: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "ADVISORY"]
    alert_train_id: str  # Which train
    alert_station: str  # At which station
    
    # Content
    title: str  # Short title
    body: str  # Message body
    details: Dict  # Additional data
    
    # Routing
    channel: NotificationChannel
    recipient: NotificationRecipient
    
    # Delivery
    delivery_status: Literal["pending", "sent", "delivered", "failed"] = "pending"
    delivery_timestamp: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    
    # Response
    read: bool = False
    read_timestamp: Optional[str] = None
    response: Optional[str] = None
    response_timestamp: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            'notification_id': self.notification_id,
            'timestamp': self.timestamp,
            'severity': self.severity,
            'alert_train_id': self.alert_train_id,
            'alert_station': self.alert_station,
            'title': self.title,
            'body': self.body,
            'channel': self.channel.value,
            'recipient_id': self.recipient.recipient_id,
            'delivery_status': self.delivery_status,
            'read': self.read,
        }


# ============================================================================
# NOTIFICATION BACKEND IMPLEMENTATIONS
# ============================================================================

class NotificationBackend(ABC):
    """Abstract base for notification backends"""
    
    @abstractmethod
    def send(self, message: NotificationMessage) -> bool:
        """Send notification. Returns True if successful."""
        pass
    
    @abstractmethod
    def get_status(self, notification_id: str) -> Dict:
        """Get delivery status"""
        pass


class SMSBackend(NotificationBackend):
    """SMS delivery (e.g., Twilio, AWS SNS)"""
    
    def __init__(self, provider: str = "mock"):
        self.provider = provider  # "twilio", "sns", "local", or "mock"
        self.sent_messages = []
    
    def send(self, msg: NotificationMessage) -> bool:
        """Send SMS"""
        if not msg.recipient.phone:
            logger.error(f"No phone for SMS: {msg.recipient.recipient_id}")
            return False
        
        if self.provider == "mock":
            return self._send_mock(msg)
        elif self.provider == "twilio":
            return self._send_twilio(msg)
        else:
            logger.warning(f"Unknown SMS provider: {self.provider}")
            return False
    
    def _send_mock(self, msg: NotificationMessage) -> bool:
        """Mock SMS delivery"""
        sms_body = f"[{msg.severity}] {msg.title}\n{msg.body[:100]}"
        logger.info(f"[SMS] To {msg.recipient.phone}: {sms_body}")
        self.sent_messages.append({'phone': msg.recipient.phone, 'body': sms_body})
        msg.delivery_status = "delivered"
        msg.delivery_timestamp = datetime.now().isoformat()
        return True
    
    def _send_twilio(self, msg: NotificationMessage) -> bool:
        """Send via Twilio (requires credentials)"""
        try:
            from twilio.rest import Client
        except ImportError:
            logger.error("Twilio SDK not installed. pip install twilio")
            return False
        
        # Use environment variables for credentials
        import os
        account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        api_key = os.getenv('TWILIO_API_KEY_SID') or os.getenv('TWILIO_API_KEY')
        api_secret = os.getenv('TWILIO_API_KEY_SECRET')
        from_number = os.getenv('TWILIO_FROM_NUMBER')
        
        has_key_auth = bool(api_key and api_secret)
        has_token_auth = bool(account_sid and auth_token)

        if not (has_key_auth or has_token_auth):
            logger.error("Twilio credentials not configured")
            return False
            
        if not from_number:
            logger.warning("TWILIO_FROM_NUMBER not set; Twilio SMS cannot specify sender")
            return False
        
        try:
            if has_key_auth:
                client = Client(api_key, api_secret, account_sid=account_sid)
            else:
                client = Client(account_sid, auth_token)
                
            message = client.messages.create(
                body=f"[{msg.severity}] {msg.title}: {msg.body}",
                from_=from_number,
                to=msg.recipient.phone
            )
            logger.info(f"SMS sent: {message.sid}")
            msg.delivery_status = "delivered"
            msg.delivery_timestamp = datetime.now().isoformat()
            return True
        except Exception as e:
            logger.error(f"Twilio SMS failed: {e}")
            return False
    
    def get_status(self, notification_id: str) -> Dict:
        return {'status': 'delivered', 'notification_id': notification_id}


class VoiceBackend(NotificationBackend):
    """Voice call delivery via Twilio Voice API for critical emergencies"""
    
    def __init__(self, provider: str = "twilio"):
        self.provider = provider
        self.sent_calls = []
        self._last_call_time = 0.0
        self._cooldown_seconds = 120  # 2-minute cooldown between calls to prevent spamming
        
    def send(self, msg: NotificationMessage) -> bool:
        """Place an automated voice call"""
        phone = msg.recipient.phone or os.getenv("TWILIO_EMERGENCY_PHONE")
        if not phone:
            logger.error(f"No phone for Voice Call: {msg.recipient.recipient_id}")
            return False
            
        if self.provider == "mock":
            logger.info(f"[VOICE MOCK] Calling {phone}: {msg.title}")
            msg.delivery_status = "delivered"
            msg.delivery_timestamp = datetime.now().isoformat()
            return True
        elif self.provider == "twilio":
            return self._send_twilio_call(msg, phone)
        else:
            logger.warning(f"Unknown Voice provider: {self.provider}")
            return False
            
    def _send_twilio_call(self, msg: NotificationMessage, to_phone: str) -> bool:
        import os
        import time
        now = time.time()
        if (now - self._last_call_time) < self._cooldown_seconds:
            logger.warning(f"[VOICE] Rate limited: {int(self._cooldown_seconds - (now - self._last_call_time))}s cooldown remaining")
            return False
            
        try:
            from twilio.rest import Client
        except ImportError:
            logger.error("Twilio SDK not installed")
            return False
            
        account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        from_number = os.getenv('TWILIO_FROM_NUMBER')
        
        if not (account_sid and auth_token and from_number):
            logger.error("Twilio Voice credentials not fully configured")
            return False
            
        try:
            client = Client(account_sid, auth_token)
            clean_title = (msg.title or "Critical collision risk").replace('<', '').replace('>', '')
            station_info = msg.alert_station or "active junction"
            train_info = msg.alert_train_id or "monitored fleet"
            twiml = (
                f'<Response>'
                f'<Say voice="Polly.Aditi" language="en-IN">'
                f'Attention operations. This is an urgent safety alert from Drishti. '
                f'Critical situation detected for train {train_info} at station {station_info}. '
                f'{clean_title}. Immediate intervention required.'
                f'</Say>'
                f'</Response>'
            )
            call = client.calls.create(
                twiml=twiml,
                from_=from_number,
                to=to_phone
            )
            self._last_call_time = now
            logger.info(f"[VOICE] Critical alert call dispatched: SID {call.sid} to {to_phone}")
            msg.delivery_status = "delivered"
            msg.delivery_timestamp = datetime.now().isoformat()
            return True
        except Exception as e:
            logger.error(f"[VOICE] Twilio Call failed: {e}")
            return False
            
    def get_status(self, notification_id: str) -> Dict:
        return {'status': 'delivered', 'notification_id': notification_id}


class EmailBackend(NotificationBackend):
    """Email delivery"""
    
    def __init__(self, provider: str = "mock"):
        self.provider = provider  # "gmail", "sendgrid", "ses", "mock"
        self.sent_emails = []
    
    def send(self, msg: NotificationMessage) -> bool:
        """Send email"""
        if not msg.recipient.email:
            logger.error(f"No email for: {msg.recipient.recipient_id}")
            return False
        
        if self.provider == "mock":
            return self._send_mock(msg)
        elif self.provider == "sendgrid":
            return self._send_sendgrid(msg)
        else:
            return False
    
    def _send_mock(self, msg: NotificationMessage) -> bool:
        """Mock email delivery"""
        email_body = f"""
            Subject: [{msg.severity}] {msg.title}
            To: {msg.recipient.email}
            
            Alert: {msg.title}
            Train: {msg.alert_train_id}
            Station: {msg.alert_station}
            
            {msg.body}
        """
        logger.info(f"[EMAIL] To {msg.recipient.email}: {msg.title}")
        self.sent_emails.append({'to': msg.recipient.email, 'subject': msg.title})
        msg.delivery_status = "delivered"
        msg.delivery_timestamp = datetime.now().isoformat()
        return True
    
    def _send_sendgrid(self, msg: NotificationMessage) -> bool:
        """Send via SendGrid"""
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail
        except ImportError:
            logger.error("SendGrid SDK not installed. pip install sendgrid")
            return False
        
        import os
        sg_key = os.getenv('SENDGRID_API_KEY')
        if not sg_key:
            logger.error("SENDGRID_API_KEY not set")
            return False
        
        try:
            email = Mail(
                from_email='drishti@ir.gov.in',
                to_emails=msg.recipient.email,
                subject=f"[{msg.severity}] {msg.title}",
                plain_text_content=msg.body
            )
            sg = SendGridAPIClient(sg_key)
            response = sg.send(email)
            logger.info(f"Email sent: {response.status_code}")
            msg.delivery_status = "delivered"
            return True
        except Exception as e:
            logger.error(f"SendGrid email failed: {e}")
            return False
    
    def get_status(self, notification_id: str) -> Dict:
        return {'status': 'delivered', 'notification_id': notification_id}


class PushBackend(NotificationBackend):
    """Push notifications to mobile app"""
    
    def __init__(self, provider: str = "mock"):
        self.provider = provider  # "fcm", "apns", "mock"
        self.sent_pushes = []
    
    def send(self, msg: NotificationMessage) -> bool:
        """Send push notification"""
        if not msg.recipient.app_user_id:
            logger.error(f"No app user ID for: {msg.recipient.recipient_id}")
            return False
        
        if self.provider == "mock":
            return self._send_mock(msg)
        elif self.provider == "fcm":
            return self._send_fcm(msg)
        else:
            return False
    
    def _send_mock(self, msg: NotificationMessage) -> bool:
        """Mock push delivery"""
        logger.info(f"[PUSH] To {msg.recipient.app_user_id}: {msg.title}")
        self.sent_pushes.append({'user_id': msg.recipient.app_user_id, 'title': msg.title})
        msg.delivery_status = "delivered"
        msg.delivery_timestamp = datetime.now().isoformat()
        return True
    
    def _send_fcm(self, msg: NotificationMessage) -> bool:
        """Send via Firebase Cloud Messaging"""
        try:
            from firebase_admin import messaging
        except ImportError:
            logger.error("Firebase SDK not installed. pip install firebase-admin")
            return False
        
        try:
            notification = messaging.Notification(
                title=msg.title,
                body=msg.body
            )
            data = {
                'severity': msg.severity,
                'train_id': msg.alert_train_id,
                'station': msg.alert_station,
                'alert_id': msg.details.get('alert_id', '')
            }
            message = messaging.Message(
                notification=notification,
                data=data,
                token=msg.recipient.app_user_id
            )
            response = messaging.send(message)
            logger.info(f"Push sent: {response}")
            msg.delivery_status = "delivered"
            return True
        except Exception as e:
            logger.error(f"FCM push failed: {e}")
            return False
    
    def get_status(self, notification_id: str) -> Dict:
        return {'status': 'delivered', 'notification_id': notification_id}


class CentralLogBackend(NotificationBackend):
    """Central operations room log display"""
    
    def __init__(self):
        self.logs = []
    
    def send(self, msg: NotificationMessage) -> bool:
        """Log to central system"""
        log_entry = {
            'timestamp': msg.timestamp,
            'severity': msg.severity,
            'train_id': msg.alert_train_id,
            'station': msg.alert_station,
            'title': msg.title,
            'body': msg.body,
            'recipient': msg.recipient.role.value
        }
        self.logs.append(log_entry)
        logger.info(f"[CENTRAL_LOG] {msg.title} - Train {msg.alert_train_id} at {msg.alert_station}")
        msg.delivery_status = "delivered"
        return True
    
    def get_status(self, notification_id: str) -> Dict:
        return {'status': 'delivered', 'notification_id': notification_id}


# ============================================================================
# NOTIFICATION ROUTER & DISPATCHER
# ============================================================================

class NotificationRouter:
    """Routes alerts to appropriate recipients on appropriate channels"""
    
    def __init__(self):
        import os
        sms_provider = os.getenv("SMS_PROVIDER", "mock")
        voice_provider = os.getenv("VOICE_PROVIDER", "twilio")
        self.sms_backend = SMSBackend(provider=sms_provider)
        self.voice_backend = VoiceBackend(provider=voice_provider)
        self.email_backend = EmailBackend(provider="mock")
        self.push_backend = PushBackend(provider="mock")
        self.central_backend = CentralLogBackend()
        self.messages_sent = []
    
    def route_alert(self, severity: str, train_id: str, station: str, 
                    alert_title: str, alert_body: str, details: Dict) -> List[NotificationMessage]:
        """Route alert to appropriate recipients based on severity/type"""
        
        messages = []
        
        # Determine recipients based on severity and role
        recipients = self._determine_recipients(severity, station, train_id)
        
        # Send via appropriate channels
        for recipient in recipients:
            for channel in recipient.get_channels():
                msg = NotificationMessage(
                    notification_id=f"notif_{train_id}_{recipient.recipient_id}_{channel.value}",
                    timestamp=datetime.now().isoformat(),
                    severity=severity,
                    alert_train_id=train_id,
                    alert_station=station,
                    title=alert_title,
                    body=alert_body,
                    details=details,
                    channel=channel,
                    recipient=recipient
                )
                
                # Send via backend
                success = self._send_via_channel(msg, channel)
                msg.delivery_status = "delivered" if success else "failed"
                
                messages.append(msg)
                self.messages_sent.append(msg)
        
        return messages
    
    def _determine_recipients(self, severity: str, station: str, train_id: str) -> List[NotificationRecipient]:
        """Determine who should be notified"""
        recipients = []
        
        # CRITICAL: Alert everyone + automated voice call to emergency phone
        if severity == "CRITICAL":
            import os
            emergency_phone = os.getenv("TWILIO_EMERGENCY_PHONE")
            recipients = [
                NotificationRecipient(
                    recipient_id="LOCO_PILOT_001",
                    name="Loco Pilot (Emergency)",
                    role=RecipientRole.LOCO_PILOT,
                    phone=emergency_phone,
                    email="pilot@ir.gov.in",
                    app_user_id="pilot_001"
                ),
                NotificationRecipient(
                    recipient_id="SIGNAL_001",
                    name="Signal Officer",
                    role=RecipientRole.SIGNALLING_OFFICER,
                    phone=emergency_phone,
                    email="signal@ir.gov.in",
                    app_user_id="signal_001"
                ),
                NotificationRecipient(
                    recipient_id="CENTRAL_001",
                    name="Central Operations",
                    role=RecipientRole.CENTRAL_OPERATIONS,
                    email="central@ir.gov.in",
                    app_user_id="central_001"
                ),
            ]
        
        # HIGH: Station master + signalling
        elif severity == "HIGH":
            recipients = [
                NotificationRecipient(
                    recipient_id=f"STATION_MASTER_{station}",
                    name=f"Station Master {station}",
                    role=RecipientRole.STATION_MASTER,
                    phone="+917777777777",
                    email=f"station_{station}@ir.gov.in"
                ),
                NotificationRecipient(
                    recipient_id="SIGNAL_001",
                    name="Signal Officer",
                    role=RecipientRole.SIGNALLING_OFFICER,
                    email="signal@ir.gov.in",
                    app_user_id="signal_001"
                ),
            ]
        
        # MEDIUM/LOW: Log only
        else:
            recipients = [
                NotificationRecipient(
                    recipient_id="CENTRAL_001",
                    name="Central Operations",
                    role=RecipientRole.CENTRAL_OPERATIONS,
                    email="central@ir.gov.in"
                ),
            ]
        
        return recipients
    
    def _send_via_channel(self, msg: NotificationMessage, channel: NotificationChannel) -> bool:
        """Send message via specified channel"""
        if channel == NotificationChannel.VOICE:
            return self.voice_backend.send(msg)
        elif channel == NotificationChannel.SMS:
            return self.sms_backend.send(msg)
        elif channel == NotificationChannel.EMAIL:
            return self.email_backend.send(msg)
        elif channel == NotificationChannel.PUSH:
            return self.push_backend.send(msg)
        elif channel == NotificationChannel.CENTRAL_LOG:
            return self.central_backend.send(msg)
        else:
            logger.warning(f"Unknown channel: {channel}")
            return False
    
    def get_delivery_status(self) -> Dict:
        """Get overall delivery stats"""
        total = len(self.messages_sent)
        delivered = sum(1 for m in self.messages_sent if m.delivery_status == "delivered")
        failed = sum(1 for m in self.messages_sent if m.delivery_status == "failed")
        
        return {
            'total_messages': total,
            'delivered': delivered,
            'failed': failed,
            'success_rate': (delivered / total * 100) if total > 0 else 0
        }


if __name__ == '__main__':
    # Example usage
    router = NotificationRouter()
    
    messages = router.route_alert(
        severity="CRITICAL",
        train_id="TRAIN_12345",
        station="Balasore",
        alert_title="ACCIDENT RISK DETECTED",
        alert_body="Multiple ML methods predict high risk. Speed reduced, emergency procedures initiated.",
        details={'confidence': 0.92, 'methods_agreeing': 4}
    )
    
    print(f"\nRouted {len(messages)} notifications:")
    for msg in messages:
        print(f"  - {msg.recipient.role.value}: {msg.channel.value} ({msg.delivery_status})")
    
    print(f"\nDelivery Stats: {router.get_delivery_status()}")
