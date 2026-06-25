from rest_framework import serializers
from .models import Attendance, ODRequest


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


class ODRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.username', read_only=True)
    student_roll_no = serializers.CharField(source='student.roll_number', read_only=True)
    category_label = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = ODRequest
        fields = [
            'id', 'student', 'student_name', 'student_roll_no',
            'from_date', 'to_date',
            'category', 'category_label', 'reason', 'proof',
            'status', 'stage',
            'tutor_remark', 'tutor_reviewed_at',
            'hod_remark', 'hod_reviewed_at',
            'created_at',
        ]
        read_only_fields = [
            'student', 'status', 'stage',
            'tutor_remark', 'tutor_reviewed_at',
            'hod_remark', 'hod_reviewed_at', 'created_at',
        ]

    def validate(self, data):
        if data['to_date'] < data['from_date']:
            raise serializers.ValidationError("to_date cannot be before from_date.")
        return data