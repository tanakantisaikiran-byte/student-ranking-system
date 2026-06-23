# app.py
# Backend Flask application for Student Ranking System with Heap Sort

import os
import sqlite3
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)
DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    if not os.path.exists(DATABASE):
        # Create database file
        open(DATABASE, 'w').close()
    with get_db_connection() as conn:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'schema.sql'), 'r') as f:
            conn.executescript(f.read())
        conn.commit()

# --- Heap Sort Algorithm Implementation ---

def heapify(arr, n, i, key):
    largest = i
    l = 2 * i + 1
    r = 2 * i + 2
    
    # Compare elements using the provided key function
    if l < n and key(arr[l]) > key(arr[largest]):
        largest = l
    if r < n and key(arr[r]) > key(arr[largest]):
        largest = r
        
    if largest != i:
        arr[i], arr[largest] = arr[largest], arr[i]
        heapify(arr, n, largest, key)

def heap_sort(arr, key=lambda x: x):
    """
    In-place heap sort.
    Sorts array in ascending order of the comparison key.
    For students, our key is: (-total_score, roll_number).
    So ascending order of this key gives:
    - Higher score (more negative key value) first
    - If scores are equal, roll number lexicographically smaller (A < B) first
    """
    n = len(arr)
    
    # Build a max heap
    for i in range(n // 2 - 1, -1, -1):
        heapify(arr, n, i, key)
        
    # One by one extract elements from heap
    for i in range(n - 1, 0, -1):
        arr[i], arr[0] = arr[0], arr[i] # swap
        heapify(arr, i, 0, key)
        
    return arr

# --- Database & Ranking Helpers ---

def get_all_students_data(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, roll_number, branch, year, rank FROM students")
    students_list = [dict(row) for row in cursor.fetchall()]
    
    cursor.execute("SELECT student_id, subject_name, score FROM student_scores")
    scores_list = [dict(row) for row in cursor.fetchall()]
    
    # Group scores by student_id
    student_scores = {}
    for score in scores_list:
        sid = score['student_id']
        if sid not in student_scores:
            student_scores[sid] = []
        student_scores[sid].append(score)
        
    for s in students_list:
        s_id = s['id']
        s['subjects'] = student_scores.get(s_id, [])
        s['total_score'] = sum(subj['score'] for subj in s['subjects'])
        s['average_score'] = round(s['total_score'] / len(s['subjects']), 2) if s['subjects'] else 0.0
        
    return students_list

def recalculate_and_save_rankings(conn):
    students = get_all_students_data(conn)
    if not students:
        return []
    
    # Sort students using Heap Sort
    # Key sorts by:
    # 1. Total Score descending (so we use negative total score)
    # 2. Roll Number ascending (string comparison)
    heap_sort(students, key=lambda x: (-x['total_score'], x['roll_number']))
    
    # Update ranks in database
    for idx, student in enumerate(students):
        rank = idx + 1
        student['rank'] = rank
        conn.execute("UPDATE students SET rank = ? WHERE id = ?", (rank, student['id']))
        
    conn.commit()
    return students

# --- Flask Routes ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/students', methods=['GET'])
def get_students():
    try:
        with get_db_connection() as conn:
            students = get_all_students_data(conn)
        return jsonify(students)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/students', methods=['POST'])
def add_student():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    roll_number = data.get('roll_number', '').strip()
    branch = data.get('branch', '').strip()
    year_val = data.get('year')
    subjects = data.get('subjects', [])
    
    # Validation
    if not name or not roll_number or not branch or year_val is None:
        return jsonify({"error": "Name, Roll Number, Branch, and Year are required."}), 400
        
    try:
        year = int(year_val)
        if year < 1 or year > 4:
            raise ValueError()
    except ValueError:
        return jsonify({"error": "Year must be an integer between 1 and 4."}), 400
        
    # Validate subjects
    validated_subjects = []
    seen_subjects = set()
    for sub in subjects:
        sub_name = sub.get('subject_name', '').strip()
        score_val = sub.get('score')
        if not sub_name:
            continue
        try:
            score = float(score_val)
            if score < 0 or score > 100:
                return jsonify({"error": f"Score for {sub_name} must be between 0 and 100."}), 400
        except (ValueError, TypeError):
            return jsonify({"error": f"Score for {sub_name} must be a number."}), 400
            
        if sub_name.lower() in seen_subjects:
            return jsonify({"error": f"Duplicate subject '{sub_name}' found."}), 400
        seen_subjects.add(sub_name.lower())
        validated_subjects.append((sub_name, score))

    try:
        with get_db_connection() as conn:
            # Check unique roll number
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM students WHERE roll_number = ?", (roll_number,))
            if cursor.fetchone():
                return jsonify({"error": f"Roll Number '{roll_number}' already exists."}), 400
                
            # Insert student
            cursor.execute(
                "INSERT INTO students (name, roll_number, branch, year) VALUES (?, ?, ?, ?)",
                (name, roll_number, branch, year)
            )
            student_id = cursor.lastrowid
            
            # Insert scores
            for sub_name, score in validated_subjects:
                cursor.execute(
                    "INSERT INTO student_scores (student_id, subject_name, score) VALUES (?, ?, ?)",
                    (student_id, sub_name, score)
                )
                
            # Recalculate ranks
            recalculate_and_save_rankings(conn)
            
            # Fetch updated student record
            cursor.execute("SELECT id, name, roll_number, branch, year, rank FROM students WHERE id = ?", (student_id,))
            student_data = dict(cursor.fetchone())
            student_data['subjects'] = [{"subject_name": name, "score": sc} for name, sc in validated_subjects]
            student_data['total_score'] = sum(sc for _, sc in validated_subjects)
            student_data['average_score'] = round(student_data['total_score'] / len(validated_subjects), 2) if validated_subjects else 0.0
            
        return jsonify(student_data), 211
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/students/<int:student_id>', methods=['PUT'])
def update_student(student_id):
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    roll_number = data.get('roll_number', '').strip()
    branch = data.get('branch', '').strip()
    year_val = data.get('year')
    subjects = data.get('subjects', [])
    
    # Validation
    if not name or not roll_number or not branch or year_val is None:
        return jsonify({"error": "Name, Roll Number, Branch, and Year are required."}), 400
        
    try:
        year = int(year_val)
        if year < 1 or year > 4:
            raise ValueError()
    except ValueError:
        return jsonify({"error": "Year must be an integer between 1 and 4."}), 400
        
    # Validate subjects
    validated_subjects = []
    seen_subjects = set()
    for sub in subjects:
        sub_name = sub.get('subject_name', '').strip()
        score_val = sub.get('score')
        if not sub_name:
            continue
        try:
            score = float(score_val)
            if score < 0 or score > 100:
                return jsonify({"error": f"Score for {sub_name} must be between 0 and 100."}), 400
        except (ValueError, TypeError):
            return jsonify({"error": f"Score for {sub_name} must be a number."}), 400
            
        if sub_name.lower() in seen_subjects:
            return jsonify({"error": f"Duplicate subject '{sub_name}' found."}), 400
        seen_subjects.add(sub_name.lower())
        validated_subjects.append((sub_name, score))

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Verify student exists
            cursor.execute("SELECT id FROM students WHERE id = ?", (student_id,))
            if not cursor.fetchone():
                return jsonify({"error": "Student not found."}), 404
                
            # Verify unique roll number
            cursor.execute("SELECT id FROM students WHERE roll_number = ? AND id != ?", (roll_number, student_id))
            if cursor.fetchone():
                return jsonify({"error": f"Roll Number '{roll_number}' is already taken."}), 400
                
            # Update student
            cursor.execute(
                "UPDATE students SET name = ?, roll_number = ?, branch = ?, year = ? WHERE id = ?",
                (name, roll_number, branch, year, student_id)
            )
            
            # Delete old scores
            cursor.execute("DELETE FROM student_scores WHERE student_id = ?", (student_id,))
            
            # Insert new scores
            for sub_name, score in validated_subjects:
                cursor.execute(
                    "INSERT INTO student_scores (student_id, subject_name, score) VALUES (?, ?, ?)",
                    (student_id, sub_name, score)
                )
                
            # Recalculate ranks
            recalculate_and_save_rankings(conn)
            
            # Fetch updated data
            cursor.execute("SELECT id, name, roll_number, branch, year, rank FROM students WHERE id = ?", (student_id,))
            student_data = dict(cursor.fetchone())
            student_data['subjects'] = [{"subject_name": name, "score": sc} for name, sc in validated_subjects]
            student_data['total_score'] = sum(sc for _, sc in validated_subjects)
            student_data['average_score'] = round(student_data['total_score'] / len(validated_subjects), 2) if validated_subjects else 0.0
            
        return jsonify(student_data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/students/<int:student_id>', methods=['DELETE'])
def delete_student(student_id):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM students WHERE id = ?", (student_id,))
            if not cursor.fetchone():
                return jsonify({"error": "Student not found."}), 404
                
            cursor.execute("DELETE FROM students WHERE id = ?", (student_id,))
            recalculate_and_save_rankings(conn)
        return jsonify({"message": "Student deleted successfully."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/rankings', methods=['GET'])
def get_rankings():
    try:
        with get_db_connection() as conn:
            students = recalculate_and_save_rankings(conn)
        return jsonify(students)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
