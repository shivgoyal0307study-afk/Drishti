#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Seed Realistic Demo Data for DRISHTI (Hackathon Demo)
Clears existing database and populates with a structured network of stations, junctions, and trains.
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timedelta, timezone
import random

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

# Ensure database is SQLite to safely drop/recreate for demo
from backend.db.session import engine, Base, SessionLocal
from backend.db.models import Station, Train, TrainTelemetry, DataIngestionRun

def reset_database():
    """Drop all tables and recreate them to match new schema."""
    print("🗑️  Dropping existing tables...")
    Base.metadata.drop_all(bind=engine)
    print("🏗️  Recreating tables with updated schema...")
    Base.metadata.create_all(bind=engine)

def seed_data():
    db = SessionLocal()
    try:
        # 1. Stations & Junctions
        stations_data = [
            # Northern Zone (NR)
            {"code": "NDLS", "name": "New Delhi", "lat": 28.6415, "lng": 77.2183, "zone": "NR"},
            {"code": "CNB", "name": "Kanpur Central", "lat": 26.4547, "lng": 80.3507, "zone": "NCR"},
            {"code": "PRYJ", "name": "Prayagraj Junction", "lat": 25.4358, "lng": 81.8463, "zone": "NCR"},
            {"code": "LKO", "name": "Lucknow Charbagh", "lat": 26.8329, "lng": 80.9200, "zone": "NR"},
            {"code": "BSB", "name": "Varanasi Junction", "lat": 25.3340, "lng": 82.9868, "zone": "NR"},
            {"code": "AGC", "name": "Agra Cantt", "lat": 27.1594, "lng": 77.9892, "zone": "NCR"},
            
            # Eastern Zone (ER/ECR)
            {"code": "HWH", "name": "Howrah Junction", "lat": 22.5833, "lng": 88.3333, "zone": "ER"},
            {"code": "SDAH", "name": "Sealdah", "lat": 22.5694, "lng": 88.3734, "zone": "ER"},
            {"code": "PNBE", "name": "Patna Junction", "lat": 25.6030, "lng": 85.1360, "zone": "ECR"},
            {"code": "GAYA", "name": "Gaya Junction", "lat": 24.7964, "lng": 84.9914, "zone": "ECR"},
            {"code": "DDU", "name": "Pt. DD Upadhyaya", "lat": 25.2796, "lng": 83.1166, "zone": "ECR"},
            
            # Western Zone (WR/CR)
            {"code": "CSMT", "name": "Chhatrapati Shivaji Maharaj", "lat": 18.9398, "lng": 72.8354, "zone": "CR"},
            {"code": "BCT", "name": "Mumbai Central", "lat": 18.9697, "lng": 72.8194, "zone": "WR"},
            {"code": "PUNE", "name": "Pune Junction", "lat": 18.5284, "lng": 73.8739, "zone": "CR"},
            {"code": "ADI", "name": "Ahmedabad Junction", "lat": 23.0258, "lng": 72.6008, "zone": "WR"},
            {"code": "BRC", "name": "Vadodara Junction", "lat": 22.3117, "lng": 73.1812, "zone": "WR"},
            {"code": "ST", "name": "Surat", "lat": 21.2045, "lng": 72.8398, "zone": "WR"},
            
            # Southern Zone (SR/SCR)
            {"code": "MAS", "name": "MGR Chennai Central", "lat": 13.0827, "lng": 80.2707, "zone": "SR"},
            {"code": "SBC", "name": "KSR Bengaluru", "lat": 12.9779, "lng": 77.5663, "zone": "SWR"},
            {"code": "SC", "name": "Secunderabad Junction", "lat": 17.4337, "lng": 78.5016, "zone": "SCR"},
            {"code": "BZA", "name": "Vijayawada Junction", "lat": 16.5186, "lng": 80.6200, "zone": "SCR"},
            
            # East Coast Zone (ECoR) - Crucial for Balasore demo
            {"code": "BBS", "name": "Bhubaneswar", "lat": 20.2662, "lng": 85.8436, "zone": "ECoR"},
            {"code": "KGP", "name": "Kharagpur Junction", "lat": 22.3323, "lng": 87.3229, "zone": "SER"},
            {"code": "BLS", "name": "Balasore", "lat": 21.4965, "lng": 86.9238, "zone": "SER"},
        ]
        
        stations = []
        for sd in stations_data:
            st = Station(
                code=sd["code"],
                name=sd["name"],
                latitude=sd["lat"],
                longitude=sd["lng"],
                zone=sd["zone"]
            )
            db.add(st)
            stations.append(st)
            
        print(f"✅ Added {len(stations_data)} Stations")

        # 2. Trains
        # Realistic network routes sharing junctions (like CNB, DDU, BZA, BLS)
        trains_data = [
            {"id": "12003", "name": "New Delhi - Lucknow Shatabdi", "type": "Shatabdi", "priority": "HIGH", "days": "Daily", "route": ["NDLS", "CNB", "LKO"], "status": "RUNNING", "risk": "NORMAL", "delay": 0},
            {"id": "12302", "name": "Howrah Rajdhani Express", "type": "Rajdhani", "priority": "HIGH", "days": "Daily", "route": ["NDLS", "CNB", "PRYJ", "DDU", "GAYA", "HWH"], "status": "DELAYED", "risk": "WARNING", "delay": 45, "section": "CNB-PRYJ"},
            {"id": "12842", "name": "Coromandel Express", "type": "Superfast", "priority": "HIGH", "days": "Daily", "route": ["MAS", "BZA", "BBS", "BLS", "KGP", "HWH"], "status": "RUNNING", "risk": "NORMAL", "delay": 5},
            {"id": "12864", "name": "SMVB Howrah SF Express", "type": "Superfast", "priority": "NORMAL", "days": "Daily", "route": ["SBC", "MAS", "BZA", "BBS", "BLS", "KGP", "HWH"], "status": "DELAYED", "risk": "HIGH RISK", "delay": 120, "section": "BBS-BLS"},
            {"id": "12273", "name": "Howrah - New Delhi Duronto", "type": "Duronto", "priority": "HIGH", "days": "M-W-F", "route": ["HWH", "PNBE", "DDU", "CNB", "NDLS"], "status": "RUNNING", "risk": "NORMAL", "delay": 0},
            {"id": "12951", "name": "Mumbai - New Delhi Rajdhani", "type": "Rajdhani", "priority": "HIGH", "days": "Daily", "route": ["BCT", "ST", "BRC", "NDLS"], "status": "RUNNING", "risk": "NORMAL", "delay": 10},
            {"id": "12627", "name": "Karnataka Express", "type": "Express", "priority": "NORMAL", "days": "Daily", "route": ["SBC", "PUNE", "AGC", "NDLS"], "status": "RUNNING", "risk": "NORMAL", "delay": 15},
            {"id": "12723", "name": "Telangana Express", "type": "Superfast", "priority": "HIGH", "days": "Daily", "route": ["SC", "AGC", "NDLS"], "status": "RUNNING", "risk": "NORMAL", "delay": 0},
            {"id": "22691", "name": "Rajdhani Express (SBC-NZM)", "type": "Rajdhani", "priority": "HIGH", "days": "Daily", "route": ["SBC", "SC", "AGC", "NDLS"], "status": "RUNNING", "risk": "NORMAL", "delay": 0},
            {"id": "11019", "name": "Konark Express", "type": "Express", "priority": "NORMAL", "days": "Daily", "route": ["CSMT", "PUNE", "SC", "BZA", "BBS"], "status": "DELAYED", "risk": "WARNING", "delay": 35},
            {"id": "12559", "name": "Shiv Ganga Express", "type": "Superfast", "priority": "NORMAL", "days": "Daily", "route": ["BSB", "PRYJ", "NDLS"], "status": "RUNNING", "risk": "NORMAL", "delay": 0},
            {"id": "12801", "name": "Purushottam Express", "type": "Superfast", "priority": "NORMAL", "days": "Daily", "route": ["BBS", "BLS", "KGP", "GAYA", "DDU", "CNB", "NDLS"], "status": "RUNNING", "risk": "NORMAL", "delay": 0},
        ]
        
        # Add 30 more randomized demo trains to hit the 40-50 mark
        types = ["Express", "Passenger", "Superfast", "Intercity"]
        for i in range(30):
            t_id = str(13000 + i)
            origin = random.choice(stations_data)
            dest = random.choice(stations_data)
            while dest["code"] == origin["code"]:
                dest = random.choice(stations_data)
                
            delay = random.choice([0, 0, 0, 10, 25, 45, 90])
            risk = "NORMAL"
            if delay > 30: risk = "WARNING"
            if delay > 60: risk = "HIGH RISK"
            
            trains_data.append({
                "id": t_id,
                "name": f"Demo {origin['name']} - {dest['name']} Exp",
                "type": random.choice(types),
                "priority": "NORMAL",
                "days": "Daily",
                "route": [origin["code"], dest["code"]],
                "status": "RUNNING" if delay < 60 else "DELAYED",
                "risk": risk,
                "delay": delay,
                "section": ""
            })

        # Ingestion Run
        run = DataIngestionRun(
            source="demo_seed",
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
            records_received=len(trains_data),
            records_valid=len(trains_data),
            records_invalid=0,
            records_persisted=len(trains_data),
            status="completed"
        )
        db.add(run)
        db.flush()

        now = datetime.now(timezone.utc)
        
        created_trains = 0
        for td in trains_data:
            orig = td["route"][0]
            dest = td["route"][-1]
            curr_idx = random.randint(0, len(td["route"]) - 1)
            curr_station = td["route"][curr_idx]
            
            train = Train(
                train_id=td["id"],
                train_name=td["name"],
                train_type=td["type"],
                zone=next((s["zone"] for s in stations_data if s["code"] == curr_station), "UNKNOWN"),
                priority=td["priority"],
                running_days=td["days"],
                route=",".join(td["route"]),
                origin_station_code=orig,
                destination_station_code=dest,
                scheduled_departure="08:00",
                scheduled_arrival="20:00",
                current_station_code=curr_station,
                status=td["status"],
                risk_status=td["risk"],
                affected_section=td.get("section", ""),
                source="demo_seed",
                is_active=True
            )
            db.add(train)
            db.flush()
            
            st_data = next((s for s in stations_data if s["code"] == curr_station), None)
            if st_data:
                tel = TrainTelemetry(
                    train_pk=train.id,
                    train_id=train.train_id,
                    station_code=curr_station,
                    latitude=st_data["lat"],
                    longitude=st_data["lng"],
                    delay_minutes=td["delay"],
                    speed_kmh=random.randint(40, 110) if td["delay"] < 60 else random.randint(0, 20),
                    timestamp_utc=now,
                    source="demo_seed",
                    ingestion_run_id=run.id,
                    raw_payload="{}"
                )
                db.add(tel)
                created_trains += 1
                
        db.commit()
        print(f"✅ Added {created_trains} Trains with full routing and demo status.")
        print("🎉 Demo Database Seeded Successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error during seeding: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_database()
    seed_data()
