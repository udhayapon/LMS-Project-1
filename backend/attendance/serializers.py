from rest_framework import serializers
from .models import Attendance


class AttendanceSerializer(serializers.ModelSerializer):

    student_name = serializers.CharField(source='student.username', read_only=True)
    student_roll_no = serializers.CharField(source='student.roll_number', read_only=True)
    subject_name = serializers.CharField(source='teaching_assignment.subject.name', read_only=True)
    course_name = serializers.CharField(source='teaching_assignment.course.name', read_only=True)
    year_number = serializers.IntegerField(source='teaching_assignment.year.year_number', read_only=True)
    semester = serializers.IntegerField(source='teaching_assignment.subject.semester', read_only=True)

    class Meta:
        model = Attendance
        fields = [
            'id', 'teaching_assignment', 'student', 'student_name',
            'student_roll_no', 'subject_name', 'course_name',
            'year_number', 'semester',
            'date', 'hour', 'status', 'marked_by', 'created_at'
        ]
        read_only_fields = ['marked_by', 'created_at']