import urllib.request
import json

base_url = "https://educore-school-management-system.onrender.com/api"

def login():
    req = urllib.request.Request(f"{base_url}/auth/login", method="POST")
    req.add_header('Content-Type', 'application/json')
    data = json.dumps({"email": "director@sampleschools.ac.ke", "password": "SchoolGate#2026", "schoolId": None}).encode('utf-8')
    try:
        with urllib.request.urlopen(req, data=data) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        print("Login failed", e.read())
        return None

session = login()
if session and 'token' in session:
    token = session['token']
    school_id = session['user']['school_id']
    print(f"Logged in successfully. Token: {token[:10]}...")
    
    headers = {
        'Authorization': f'Bearer {token}',
        'x-school-id': str(school_id),
        'Content-Type': 'application/json'
    }
    
    # 1. Add Teachers
    for i in range(1, 4):
        t_req = urllib.request.Request(f"{base_url}/teachers", method="POST", headers=headers)
        t_data = json.dumps({
            "name": f"Demo Teacher {i}",
            "email": f"teacher{i}@sampleschools.ac.ke",
            "phone": f"070000000{i}",
            "role": "teacher",
            "status": "active"
        }).encode('utf-8')
        try:
            with urllib.request.urlopen(t_req, data=t_data) as res:
                pass
        except Exception as e:
            pass

    # 2. Get Students
    s_req = urllib.request.Request(f"{base_url}/students", method="GET", headers=headers)
    students = []
    try:
        with urllib.request.urlopen(s_req) as res:
            students_res = json.loads(res.read().decode())
            if isinstance(students_res, list): students = students_res
            elif 'data' in students_res: students = students_res['data']
    except Exception as e:
        pass
        
    print(f"Found {len(students)} students")

    # 3. Add payments and attendance for first 5 students
    import datetime
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    for s in students[:5]:
        s_id = s.get('student_id') or s.get('id')
        
        # Payment
        p_req = urllib.request.Request(f"{base_url}/payments", method="POST", headers=headers)
        p_data = json.dumps({
            "student_id": s_id,
            "amount": 5000,
            "payment_method": "bank_transfer",
            "reference": f"DEMO-{s_id}-{today}",
            "date": today,
            "status": "completed"
        }).encode('utf-8')
        try:
            with urllib.request.urlopen(p_req, data=p_data) as res:
                pass
        except Exception as e:
            pass
            
        # Attendance
        a_req = urllib.request.Request(f"{base_url}/attendance", method="POST", headers=headers)
        a_data = json.dumps({
            "student_id": s_id,
            "date": today,
            "status": "present",
            "reason": ""
        }).encode('utf-8')
        try:
            with urllib.request.urlopen(a_req, data=a_data) as res:
                pass
        except Exception as e:
            pass

    print("Seeding complete.")
else:
    print("Failed to get token")
