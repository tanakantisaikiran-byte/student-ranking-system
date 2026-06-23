# test_heap_sort.py
# Unit tests for the custom Heap Sort algorithm in app.py

import unittest
from app import heap_sort

class TestHeapSort(unittest.TestCase):

    def test_empty_array(self):
        """Test sorting an empty array."""
        arr = []
        result = heap_sort(arr, key=lambda x: x)
        self.assertEqual(result, [])

    def test_single_element(self):
        """Test sorting a single element array."""
        arr = [5]
        result = heap_sort(arr, key=lambda x: x)
        self.assertEqual(result, [5])

    def test_basic_sorting(self):
        """Test basic sorting in ascending order of integer keys."""
        arr = [9, 4, 7, 2, 1, 5, 8]
        result = heap_sort(arr, key=lambda x: x)
        self.assertEqual(result, [1, 2, 4, 5, 7, 8, 9])

    def test_sorting_student_records_primary(self):
        """Test sorting student records based on scores (descending equivalent key)."""
        students = [
            {"name": "Alice", "roll_number": "CS01", "total_score": 85.0},
            {"name": "Bob", "roll_number": "CS02", "total_score": 95.0},
            {"name": "Charlie", "roll_number": "CS03", "total_score": 90.0}
        ]
        # Sorting key: -total_score (to sort by score descending)
        result = heap_sort(students.copy(), key=lambda x: -x["total_score"])
        
        # Expected: Bob (95), Charlie (90), Alice (85)
        self.assertEqual(result[0]["name"], "Bob")
        self.assertEqual(result[1]["name"], "Charlie")
        self.assertEqual(result[2]["name"], "Alice")

    def test_sorting_student_records_with_tiebreaker(self):
        """Test sorting with secondary tie-breaker (Roll Number ascending) when scores are equal."""
        students = [
            {"name": "Alice", "roll_number": "CS03", "total_score": 90.0},
            {"name": "Bob", "roll_number": "CS01", "total_score": 90.0},
            {"name": "Charlie", "roll_number": "CS02", "total_score": 90.0},
            {"name": "David", "roll_number": "CS04", "total_score": 95.0}
        ]
        # Sorting key: (-total_score, roll_number)
        result = heap_sort(students.copy(), key=lambda x: (-x["total_score"], x["roll_number"]))
        
        # Expected: 
        # 1. David (95.0, CS04)
        # 2. Bob (90.0, CS01)
        # 3. Charlie (90.0, CS02)
        # 4. Alice (90.0, CS03)
        self.assertEqual(result[0]["name"], "David")
        self.assertEqual(result[1]["name"], "Bob")
        self.assertEqual(result[2]["name"], "Charlie")
        self.assertEqual(result[3]["name"], "Alice")

    def test_already_sorted(self):
        """Test sorting an already sorted array."""
        arr = [1, 2, 3, 4, 5]
        result = heap_sort(arr.copy(), key=lambda x: x)
        self.assertEqual(result, [1, 2, 3, 4, 5])

    def test_reverse_sorted(self):
        """Test sorting a reverse sorted array."""
        arr = [5, 4, 3, 2, 1]
        result = heap_sort(arr.copy(), key=lambda x: x)
        self.assertEqual(result, [1, 2, 3, 4, 5])

if __name__ == '__main__':
    unittest.main()
